const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
//node:path tells node.js to ignore the node_modules folder
const path = require('node:path');
const session = require("express-session");
const config = require('./config');
const FileStore = require('session-file-store')(session);
const bcrypt = require("bcrypt");
const connectDB = require('./db-connection.js');
const app = express();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const groupsRoutes = require("./routes/groups");
const authRoutes= require("./routes/auth");
const usersRoutes = require("./routes/users");
const server = http.createServer(app);
const io = new Server(server);

// Live-Chat Logik
io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
    });

    socket.on('chatMessage', (data) => {
        // Sendet die Nachricht an alle in diesem Raum
        io.to(data.roomId).emit('message', data);
    });
});

// Parse urlencoded bodies
app.use(express.json())
let db;
// Session middeware
// instead of nodemon, use node server/server.js
// maybe use helmet later on
app.use(session({
    //needs to store the sessio somewhere
    store: new FileStore({ path: path.join(__dirname, 'sessions') }),
    secret: config.JWT_SECRET,
    resave: false,
    //tells the server that the session is stored
    saveUninitialized: false,
    cookie: {
        secure: false,      // Set to true if using HTTPS
        httpOnly: true,     //makes it harder to steal cookies using JS
        sameSite:'strict'   //prevents cross-site request forgery attacks (example: you leave Plafin open in a new tab and visit a malicious website, the website could send a request via the open Plafin tab)
    }
}));

//required login so people are not allowed to make Post requests without being logged in
//middleware
//used for post methods
app.get('/lobbies.html', (req, res) => {
    if(req.session.user) {
        res.sendFile(path.join(__dirname, '../frontend/lobbies.html'));
    }else{
        res.redirect('/');
    }
});


app.get('/dashboard', (req, res) => {
    if(req.session.user) {
        res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
    }else{
        res.redirect('/');
    }
});

app.get('/lobby-room.html', (req, res) => {
    if(req.session.user) {
        res.sendFile(path.join(__dirname, '../frontend/lobby-room.html'));
    }else{
        res.redirect('/');
    }
});

app.use(express.static(path.join(__dirname, '../frontend')));
const requiredLogin = (req, res, next) => {
    if(req.session.user) {
        next();
    }else{
        res.status(401).send('Not logged in');
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try{
        const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];
        if(user && bcrypt.compareSync(password, user.password_hash)) {
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                loginMethod: 'local',
                loginTime: new Date().toISOString(),
                avatar_url: user.avatar_url,
            };

            res.status(200).json(req.session.user);
        } else {
            res.status(401).json({error: 'Invalid username or password'});
        }
    }catch(err){
        console.error("Login error: " ,err);
        res.status(500).json({error: 'Internal Server Error'});
    }
});

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.sendStatus(200);
});

//sends session from user
app.get("/session", function (req, res) {
    if (req.session.user) {
        res.send(req.session.user);
    } else {
        res.status(401).json(null);
    }
});

//for later give error for Username or Email if User already exists
app.post('/register', async (req, res) => {
    const {email, registerUsername, registerPassword, confirmPassword} = req.body;


    if(registerPassword !== confirmPassword) {
        return res.status(401).send('Passwords don\'t match');
    }
    try{
        //passwort verschlüsseln
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(registerPassword, saltRounds);

        const query = `
            INSERT INTO users (username, email, password_hash) 
            VALUES ($1, $2, $3) 
            RETURNING id, username;
        `;

        const values = [registerUsername, email, password_hash];

        const result = await db.query(query, values);

        console.log("New User saved in database: ",result.rows[0]);
        res.status(201).send("Registration successful");
    }catch(err){
        console.error("Error with registration", err);

        if(err.code==="23505"){
            res.status(401).json({error: "User already exists"});
        }else{
            res.status(500).json({error:"Internal Server Error"});
        }
    }
});

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = result.rows[0];



        if (!user||!user.password_hash) {
            return res.status(200).json({ message: "If this account exists, you will receive an email." });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 15);

        await db.query(
            "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
            [resetToken, resetTokenExpires, email]
        );

        const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log("User found:", email);
        console.log("Reset token created:", resetToken);
        console.log("Reset link:", resetLink);

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Reset your Plafin password",
                text: `Click this link to reset your password: ${resetLink}`
            });

            return res.status(200).json({
                message: "Password reset link has been sent to your email."
            });

        } catch (mailErr) {
            console.error("Email could not be sent:", mailErr);
            console.log("Use this reset link manually:", resetLink);

            return res.status(200).json({
                message: "Email could not be sent, but reset link was created. Check server console."
            });
        }

    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const result = await db.query(
            "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
            [token]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset link." });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        await db.query(
            "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
            [password_hash, user.id]
        );

        res.status(200).json({ message: "Password reset successful." });

    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


//Get Games endpoint für erstansicht der Gruppen am dashboard
app.get("/games/load", async (req, res) => {
    try{
        const query = `
        SELECT
            game,
            COUNT(id) AS active_lobbies,
            SUM(current_players) AS players_online,
            MAX(image_url) AS image_url
        FROM groups
        GROUP BY game
        ORDER BY active_lobbies DESC;
        `;

        const result = await db.query(query);
        res.status(200).json(result.rows);
    }catch(err){
        console.error("Error fetching groups from database:", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})


app.get("/games/search", requiredLogin, async (req, res) => {
    const searchQuery = req.query.q;
    if(!searchQuery || searchQuery.trim() === ""){
        return res.status(404).json({error: "Please enter a valid search query."});
    }

    const searchTerm = searchQuery.trim();

    try{
        //nachschauen ob das game schon in der db ist
        const localSearch = await db.query('SELECT name, image_url FROM games WHERE name ILIKE $1 LIMIT 5', [`%${searchTerm}%`]);

        if(localSearch.rowCount > 0){
            console.log(`Game Found in db: ${searchTerm}`);
            return res.status(200).json(localSearch.rows);
        }

        //request RAWG API nach game
        console.log(`Game not found in db, request from RAWG API: ${searchTerm}...`);
        const response = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(searchTerm)}&key=${config.RAWG_API_KEY}`);

        if(!response.ok){
            return res.status(500).json({error: "Error fetching data from RAWG API"});
        }

        const data = await response.json();

        if(!data.results || data.results.length === 0){
            return res.status(404).json({error: "Could not find a game by that name"});
        }

        //besten 3 ergebnise
        const topGames = data.results.slice(0, 3);
        const savedGames = [];

        //Speichert bilder in db, wenn kein Bild gefunden wurde speichert es ein placeholder Bild
        for (const game of topGames){
            const img = game.background_image || "https://images.gostudent.org/user/avatar/eb378dcb-1c80-40af-b796-eb3ffa6a592b/400/400/image.png";

            const addQuery = `
                INSERT INTO games (name, image_url)
                VALUES ($1, $2)
                ON CONFLICT (name) DO NOTHING;
            `;
            await db.query(addQuery, [game.name, img]);
            savedGames.push({name: game.name, image_url: img});
        }
        return res.status(200).json(savedGames);
    }catch(err){
        console.error("Error fetching data from RAWG API", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})





app.delete("/deleteAccount", requiredLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        req.session.destroy();
        res.status(200).json({ success: true, message: "Account deleted" });
    } catch (err) {
        console.error("Error deleting account:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/changePassword", requiredLogin, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    try {
        const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        const match = await bcrypt.compare(oldPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: "Wrong password lil bro." });
        const newHash = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
        res.status(200).json({ success: true, message: "Password updated." });
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Passwort-Ändern." });
    }
});

app.post("/changeUsername", requiredLogin, async (req, res) => {
    if (req.session.user.loginMethod !== 'local') {
        return res.status(403).json({ error: "Nice try, but not you." });
    }

    const { newUsername } = req.body;
    const userId = req.session.user.id;

    try {
        // 1. Cooldown prüfen
        const result = await db.query('SELECT last_username_change FROM users WHERE id = $1', [userId]);
        const lastChange = result.rows[0].last_username_change;

        if (lastChange) {
            const timeDiff = new Date() - new Date(lastChange);
            if (timeDiff < 24 * 60 * 60 * 1000) {
                return res.status(429).json({ error: "Once a day, you gotta wait." });
            }
        }

        // 2. NUR den User aktualisieren
        // Da du ON UPDATE CASCADE hast, wird die Datenbank automatisch die
        // creator_username in der Tabelle 'groups' mit aktualisieren!
        await db.query(
            'UPDATE users SET username = $1, last_username_change = CURRENT_TIMESTAMP WHERE id = $2',
            [newUsername, userId]
        );

        // 3. Session aktualisieren
        req.session.user.username = newUsername;
        res.status(200).json({ success: true });

    } catch (err) {
        console.error("Fehler beim Username ändern:", err);
        // Prüfe, ob es ein Duplikat-Fehler (23505) ist
        if (err.code === '23505') {
            res.status(400).json({ error: "Username already taken." });
        } else {
            res.status(500).json({ error: "Interner Server Fehler" });
        }
    }
});
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Datei im RAM statt auf Festplatte

app.post('/upload-avatar', requiredLogin, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Keine Datei ausgewählt" });

    const userId = req.session.user.id;
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `avatar_${userId}_${Date.now()}.${fileExt}`;

    try {
        // 1. In Supabase Storage hochladen
        const { data, error } = await supabase.storage
            .from('avatars') // Dein Bucket-Name
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) throw error;

        // 2. Öffentliche URL generieren
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const avatarUrl = publicUrlData.publicUrl;

        // 3. In Datenbank speichern
        await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);

        // 4. Session aktualisieren
        req.session.user.avatar_url = avatarUrl;

        res.status(200).json({ success: true, avatar_url: avatarUrl });
    } catch (err) {
        console.error("Supabase Upload Fehler:", err);
        res.status(500).json({ error: "Fehler beim Cloud-Upload" });
    }
});


connectDB().then(client => {
    db = client;
    console.log("Datenbank verbunden!");

    // 2. Jetzt mounten wir den Router. Da das ganz unten passiert,
    // weiß der Router jetzt auch, dass es Sessions gibt und db ist befüllt!
    app.use('/groups', groupsRoutes(db, io));
    app.use('/auth', authRoutes(db, config))
    app.use('/users', usersRoutes(db, io))
    // 3. Server starten
    server.listen(3000, () => {
        console.log('Server running at http://localhost:3000');
    });

}).catch(err => {
    console.error("Kritischer Fehler: Datenbank konnte nicht verbunden werden!", err);
});