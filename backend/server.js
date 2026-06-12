const express = require('express');
//node:path tells node.js to ignore the node_modules folder
const path = require('node:path');
const session = require("express-session");
const config = require('./config');
const FileStore = require('session-file-store')(session);
const bcrypt = require("bcrypt");
const connectDB = require('./db-connection.js');
const app = express();

// Parse urlencoded bodies
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend')));
let db;
connectDB().then(client => {
    db = client;
});
// Session middleware
// instead of nodemon, use node server/server.js
// maybe use helmet later on
app.use(session({
    //needs to store the sessio somewhere
    store: new FileStore({ path: './sessions' }),
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

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try{
        const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];
        if(user && bcrypt.compareSync(password, user.password_hash)) {
            req.session.user = {
                id: user.id,
                username: user.username,
                loginMethod: 'local',
                loginTime: new Date().toISOString(),
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


//-----------------------------------------------------------FOR DISCORD-------------------------------------------------------------------------------------
//exchange code for access token
//async because it needs to wait for an exteral server
app.post('/auth/discord', async (req, res) => {
   try{
        const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.discord_Client_ID,
                client_secret: config.discord_Client_Secret,
                code:req.body.code,
                grant_type: 'authorization_code',
                redirect_uri: "http://localhost:3000",
                scope: 'identify',
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const oAuthData = await tokenResponseData.json();

        if(!oAuthData.access_token) {
            console.log("Discord Error: " + oAuthData);
            return res.status(400).json({error: "Could not get Discord token"});
        }

        //requests user from discord
        const me = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${oAuthData.token_type} ${oAuthData.access_token}`,
            },
        });

        const discordUser = await me.json()

       //
        let userResult = await db.query('SELECT * FROM users WHERE discord_id = $1', [discordUser.id]);
        let user = userResult.rows[0];

        if(!user){
            const insertQuery= `
                INSERT INTO users (username, discord_id) 
                VALUES ($1, $2) 
                RETURNING *;
            `;

            const values = [discordUser.username, discordUser.id];
            userResult = await db.query(insertQuery, values);
            user = userResult.rows[0];
            console.log("New Discord User saved in database:", user.username);
        }else{
            console.log("Known Discord User logged in:", user.username);
        }

        //local session gets created with discord information
        req.session.user = {
            id: user.id,
            username: user.username,
            loginMethod: 'discord'
        };

        res.status(200).json({success: true})
   }catch(err){
       console.error("Discord Auth failed: " + err);
       res.status(500).json({error: "Internal Server Error during Discord authentication"});
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
                description, 
                max_players, 
                current_players, 
                creator_username,
                tags
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
    const {game, description, max_players, tags} = req.body;

    if(!game || !description || !max_players){
        return res.status(400).json({error: "Please fill out all the fields."});
    }

    const safeTags = tags ? tags.trim() : "";

    const checkGame = await db.query('SELECT image_url FROM games WHERE name = $1', [game.trim()]);

    if (checkGame.rowCount === 0) {
        return res.status(400).json({
            error: "This game does not exist yet"
        })
    }

    const imageUrl = checkGame.rows[0].image_url;

    try{
        const query = `
        INSERT INTO groups (game, description, max_players, creator_username, tags, image_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, game, description, max_players, current_players, creator_username, tags, image_url
        `;
        const values = [game.trim(), description.trim(), parseInt(max_players), creator_username, safeTags, imageUrl];
        const result = await db.query(query, values);
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

    try{
        const result = await db.query('SELECT * FROM groups WHERE id = $1', [groupId]);
        const group = result.rows[0];

        if(!group){
            return res.status(404).json({error: "Could not find group"});
        }

        if(group.current_players >= group.max_players){
            return res.status(400).json({error: "Group is full!"});
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

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});