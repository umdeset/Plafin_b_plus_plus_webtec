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
app.use(express.static(path.join(__dirname, '../frontend')));
let db;
connectDB().then(client => {
    db = client;
});
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

app.get('/groups/:game', requiredLogin, (req, res) => {
    const game = req.params.game;
    res.redirect(path.join(`/lobbies.html?game=${encodeURIComponent(game)}`));

})

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


app.get('/dashboard',requiredLogin, (req, res) => {
    if(req.session.user) {
        res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
    }else{
        res.redirect('/');
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

    // if(userModel[registerUsername]){
    //     return res.status(409).json({error: "Username is already taken"});
    // }
    //
    // for(const user of Object.values(userModel)) {
    //     if(user.email === email){
    //         return res.status(409).json({error: "Email already exists"});
    //     }
    // }
    //
    // if(registerPassword !== confirmPassword){
    //     return res.status(401).json({error: "Password does not match"});
    // }
    //
    //
    // const hashedPassword = bcrypt.hashSync(registerPassword, 10);
    //
    // userModel[registerUsername] = {
    //     username: registerUsername,
    //     password: hashedPassword,
    //     email: email
    // }
    //
    //
    // try{
    //     const userFilePath = path.join(__dirname, 'users.json');
    //     fs.writeFileSync(userFilePath, JSON.stringify(userModel, null, 2));
    //     res.status(200).json({message: 'Successfully created user'});
    // }catch(err){
    //     console.error("Error creating user: " + err);
    //     res.status(500).json({error: "Internal Server Error"});
    // }
});

//app.delete("/deleteAccount", function (req, res) {
//    const {}
//})

//-----------------------------------------------------------FOR GOOGLE-------------------------------------------------------------------------------------
app.post('/auth/google', async (req, res) => {
    const { code } = req.body;

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: config.GOOGLE_CLIENT_ID,
                client_secret: config.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'http://localhost:3000'
            })
        });

        const tokenData = await tokenResponse.json();

        const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const googleUser = await userResponse.json();
        const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [googleUser.email]);
        if (existingUser.rows.length > 0) {
            // falls der user existiert aber noch keine google_id hat wissen wir dass er sich über die webseite schonmal registriert hat
            if (!existingUser.rows[0].google_id) {
                return res.status(409).json({ error: "Diese E-Mail ist bereits mit einem Plafin Account verknüpft. Bitte logge dich mit deinem Passwort ein." });
            }
        }
        let userResult = await db.query('SELECT * FROM users WHERE google_id = $1', [googleUser.sub]);

        if (userResult.rows.length === 0) {
            const insertQuery = 'INSERT INTO users (username, email, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *';
            userResult = await db.query(insertQuery, [googleUser.name, googleUser.email, googleUser.sub, googleUser.picture]);
        }else {
            const updateQuery = 'UPDATE users SET avatar_url = $1 WHERE google_id = $2 RETURNING *';
            userResult = await db.query(updateQuery, [googleUser.picture, googleUser.sub]);        }
        req.session.user = {
            id: userResult.rows[0].id,
            username: userResult.rows[0].username,
            loginMethod: 'google',
            avatar_url: userResult.rows[0].avatar_url,
        };
        res.status(200).json({ success: true });

    } catch (err) {
        console.error("Fehler beim Google-Login:", err);
        res.status(500).json({ error: "Google-Authentifizierung fehlgeschlagen" });
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



        if (!user) {
            return res.status(404).json({
                error: "No user found with this email address."
            });
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


//-----------------------------------------------------------FOR DISCORD-------------------------------------------------------------------------------------
//exchange code for access token
//async because it needs to wait for an exteral server
app.post('/auth/discord', async (req, res) => {
    try {
        const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.discord_Client_ID,
                client_secret: config.discord_Client_Secret,
                code: req.body.code,
                grant_type: 'authorization_code',
                redirect_uri: "http://localhost:3000",
                scope: 'identify',
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const oAuthData = await tokenResponseData.json();

        if (!oAuthData.access_token) {
            return res.status(400).json({ error: "Could not get Discord token" });
        }

        // User von Discord abrufen
        const me = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${oAuthData.token_type} ${oAuthData.access_token}`,
            },
        });

        const discordUser = await me.json();

        // 1. Avatar-URL berechnen
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

        // 2. User in DB suchen
        let userResult = await db.query('SELECT * FROM users WHERE discord_id = $1', [discordUser.id]);

        if (userResult.rows.length === 0) {
            // Neuer Discord User: INSERT
            const insertQuery = `
                INSERT INTO users (username, discord_id, avatar_url) 
                VALUES ($1, $2, $3) 
                RETURNING *;
            `;
            userResult = await db.query(insertQuery, [discordUser.username, discordUser.id, avatarUrl]);
            console.log("New Discord User saved:", discordUser.username);
        } else {
            // Bekannter User: UPDATE (falls sich das Profilbild geändert hat)
            const updateQuery = 'UPDATE users SET avatar_url = $1 WHERE discord_id = $2 RETURNING *';
            userResult = await db.query(updateQuery, [avatarUrl, discordUser.id]);
            console.log("Known Discord User logged in:", discordUser.username);
        }

        // 3. Session mit avatar_url erstellen
        const user = userResult.rows[0];
        req.session.user = {
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            loginMethod: 'discord'
        };

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Discord Auth failed: " + err);
        res.status(500).json({ error: "Internal Server Error during Discord authentication" });
    }
});

//exchange access Token for user
//combined with other method above
//app.get("/p/getDiscordUser", async (req, res) => {
//    const authString = req.headers.authorization;
//    const me = await fetch('https://discord.com/api/users/@me', {
//        headers: {
//            authorization: authString,
//        },
//    })
//    if (!me.ok) {
//        return false;
//    }
//    const response = await me.json();
//
//    const {id, username} = response;
//    const coins = memory[id] || 0
//    if (!coins) { memory[id] = 0 }
//    const user = { id, username, coins }
//    res.json(user)
//});


// group endpoints later

//app.delete('/api/users/:id')  Delete Users
//app.get('/api/groups')        Get groups
//app.post('/api/groups')       Create group
//app.put('/api/groups:id')     Update group
//app.delete('/api/groups/:id') Delete group


//get groups
//SELECT * FROM groups
//Now also can search for specific games
app.get("/groups", async (req, res) => {
    const filterGame = req.query.game;
    const filterTag = req.query.tags;

    try{
        let query = `
            SELECT 
                id, 
                game,
                title, 
                description, 
                max_players, 
                current_players, 
                creator_username,
                tags,
                image_url
            FROM groups
        `;
        let filters = [];
        let values = [];

        //gesucht nach Spiel
        if (filterGame) {
            values.push(filterGame);
            filters.push(`game = $${values.length}`);
        }
        //gesucht nach Tag
        if(filterTag) {
            values.push(`%${filterTag}%`);
            filters.push(`tags ILIKE $${values.length}`);
        }

        //Wenn filter wird AND eingefügt
        if(filters.length > 0){
            query += ` WHERE ` + filters.join(' AND ');
        }

        query += ` ORDER BY id DESC;`;

        const result = await db.query(query, values);
        res.status(200).json(result.rows);
    }catch(err){
        console.error("Error fetching groups from database:", err);
        res.status(500).json({error: "Internal Server Error"});
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

//create groups
app.post("/groups", requiredLogin, async (req, res) => {
    const creator_username = req.session.user.username;
    const creator_id = req.session.user.id;
    const {game, title, description, max_players, tags} = req.body;

    if(!game || !description || !max_players){
        return res.status(400).json({error: "Please fill out all the fields."});
    }

    const safeTags = tags ? tags.trim() : "";

    const checkUser = await db.query('SELECT user_id FROM group_members WHERE user_id = $1', [creator_id])
    const checkGame = await db.query('SELECT image_url FROM games WHERE name = $1', [game.trim()]);

    if (checkGame.rowCount === 0) {
        return res.status(400).json({
            error: "This game does not exist yet"
        })
    }

    if(checkUser.rowCount !== 0){
        return res.status(400).json({
            error: "You are already in a lobby"
        })
    }

    const imageUrl = checkGame.rows[0].image_url;

    try{
        const query = `
        INSERT INTO groups (game, title, description, max_players, creator_username, tags, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, title, game, description, max_players, current_players, creator_username, tags, image_url
        `;
        const values = [game.trim(), title.trim(), description.trim(), parseInt(max_players), creator_username, safeTags, imageUrl];
        const result = await db.query(query, values);

        const newGroup = await result.rows[0];

        const creatorId = req.session.user.id;
        await db.query(
            'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
            [newGroup.id, creatorId]
        );

        res.status(200).json({success: true, group: result.rows[0]});
    }catch (err){
        console.error("Error creating group:", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})

app.delete("/groups/:id", requiredLogin, async (req, res) => {
    const groupId = parseInt(req.params.id);
    const username = req.session.user.username;

    try{
        const query = `
            DELETE FROM groups 
            WHERE id = $1 AND creator_username = $2 
            RETURNING id;
        `;

        const values = [groupId, username];
        const result = await db.query(query, values);

        if(result.rowCount === 0){
            return res.status(404).json({error: "Could not find group"});
        }

        res.status(200).json({success: true, message: "Group deleted successfully."});
    }catch(err){
        console.error("Error deleting group:", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})

app.put("/groups/:id", requiredLogin, async (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const {game, description, max_players} = req.body;
    const creator_username = req.session.user.username;

    try{
        const query = `
            UPDATE groups 
            SET 
                game = COALESCE($1, game),
                description = COALESCE($2, description),
                max_players = COALESCE($3, max_players)
            WHERE id = $4 AND creator_username = $5
            RETURNING id, game, description, max_players, current_players, creator_username;
        `;

        const values = [game || null, description || null, max_players ? parseInt(max_players) : null, groupId, creator_username];
        const result = await db.query(query, values);

        if(result.rowCount === 0){
            return res.status(404).json({error: "Could not find group"});
        }

        res.status(200).json({success: true, group: result.rows[0], message: "Group updated successfully."});
    }catch(err){
        console.error("Error update group:", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})

app.post("/groups/:id/join", requiredLogin, async (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    try{
        const result = await db.query('SELECT * FROM groups WHERE id = $1', [groupId]);
        const group = result.rows[0];

        if(!group){
            return res.status(404).json({error: "Could not find group"});
        }

        if(group.current_players >= group.max_players){
            return res.status(400).json({error: "Group is full!"});
        }

        try{
          await db.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
        }catch(err){
            //23505 Postgres besonderer Fehler "Unique Violation", bedeutet für uns das der user schon in dieser gruppe ist
            if(err.code === '23505'){
                return res.status(400).json({error: "You already joined a group!"});
            }
            throw err;
        }
        const query = `
            UPDATE groups 
            SET current_players = current_players + 1
            WHERE id = $1
            RETURNING id, game, description, max_players, current_players;
        `;

        const updatedGroup = await db.query(query, [group.id]);

        res.status(200).json({success: true, message: "You successfully joined the group!", group: updatedGroup.rows[0]});

    }catch(err){
        console.error("Error joining group:", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})

app.delete("/groups/:id/leave", requiredLogin, async (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;


    try{
        const result = await db.query('SELECT * FROM groups WHERE id = $1', [groupId]);

        if(result.rowCount === 0){
            return res.status(404).json({error: "Could not find group"});
        }

        const deleteResult = await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);

        if(deleteResult.rowCount === 0){
            return res.status(404).json({error: "You are not in this group!"});
        }
        const query = `
            UPDATE groups 
            SET current_players = current_players - 1
            WHERE id = $1
            RETURNING id, game, description, max_players, current_players;
        `;

        const updatedGroup = await db.query(query, [groupId]);

        res.status(200).json({success: true, message: "You successfully left the group!", group: updatedGroup.rows[0]});

    }catch(err){
        console.error("Error leaving group:", err);
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

app.get("/groups/:id/members", requiredLogin, async (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    try{
        const query = `
        SELECT users.id, users.username, group_members.joined_at
        FROM group_members
        JOIN users ON group_members.user_id = users.id
        WHERE group_members.group_id = $1
        ORDER BY group_members.joined_at ASC;
        `;
        const result = await db.query(query, [groupId]);
        res.status(200).json(result.rows);
    }catch(err){
        console.error("Error fetching group members", err);
        res.status(500).json({error: "Internal Server Error"});
    }
})


app.get("/groups/:id/info", requiredLogin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({error: "Lobby not found"});
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: "Internal Server Error"});
    }
});

app.get("/user/current-group", requiredLogin, async (req, res) => {
    try {
        const result = await db.query('SELECT group_id FROM group_members WHERE user_id = $1', [req.session.user.id]);
        if (result.rowCount > 0) {
            res.status(200).json({ groupId: result.rows[0].group_id });
        } else {
            res.status(200).json({ groupId: null });
        }
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});


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


// Wir nutzen server.listen() statt app.listen() da Socket.io direkten Zugriff auf den HTTP-Server benötigt um dauerhafte Live-Verbindungen (WebSockets) für den Chat aufzubauen
server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});