const express = require('express');
//node:path tells node.js to ignore the node_modules folder
const path = require('node:path');
const session = require("express-session");
const bodyParser = require('body-parser');
const userModel = require("./user-model.js");
const config = require('./config');
const FileStore = require('session-file-store')(session);
const bcrypt = require("bcrypt");

const app = express();
const memory = {}
const fs = require('fs');


// Parse urlencoded bodies
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend')));

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

app.post("/login", function (req, res) {
    const { username, password } = req.body;
    //searches for user entry
    const user = userModel[username];
    //if the user was found and the entered password is correct create session for user
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = {
            username,
            firstName: user.firstName,
            lastName: user.lastName,
            loginTime: new Date().toISOString(),
        };
        res.send(req.session.user);
    } else {
        res.sendStatus(401);
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

app.post('/register', function (req, res) {
    const {email, registerUsername, registerPassword, confirmPassword} = req.body;

    if(userModel[registerUsername]){
        return res.status(409).json({error: "Username is already taken"});
    }

    for(const user of Object.values(userModel)) {
        if(user.email === email){
            return res.status(409).json({error: "Email already exists"});
        }
    }

    if(registerPassword !== confirmPassword){
        return res.status(401).json({error: "Password does not match"});
    }


    const hashedPassword = bcrypt.hashSync(registerPassword, 10);

    userModel[registerUsername] = {
        username: registerUsername,
        password: hashedPassword,
        email: email
    }


    try{
        const userFilePath = path.join(__dirname, 'users.json');
        fs.writeFileSync(userFilePath, JSON.stringify(userModel, null, 2));
        res.status(200).json({message: 'Successfully created user'});
    }catch(err){
        console.error("Error creating user: " + err);
        res.status(500).json({error: "Internal Server Error"});
    }
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

        //local session gets created with discord information
        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            loginMethod: 'discord'
        };

        res.status(200).json({success: true})
   }catch(err){
       console.error("Discord Auth failed: " + err);
       res.sendStatus(500).json({error: "Internal Server Error during Discord authentication"});
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

//testGroup for endpoints, later in db
let testGroups = [{
        id: 1,
        game: "Valorant",
        description: "Looking for friends",
        maxPlayers: 5,
        currentPlayers: 3, //later depends on users in group
        creator: "TestUser", //later username of creator
        //only testdata later other things like tags, rank, usw...
    },
    {
        id: 2,
        game: "Minecraft",
        description: "Chill vanilla",
        maxPlayers: 10,
        currentPlayers: 2,
        creator: "TestUser2",
    }
];
let nextGroupID = 3;

//get groups
//SELECT * FROM groups
app.get("/groups", (req, res) => {
    res.status(200).json(testGroups);
});

//create groups
app.post("/groups", requiredLogin, (req, res) => {
    const username = req.session.username;
    const {game, description, maxPlayers} = req.body;

    if(!game || !description || !maxPlayers){
        return res.status(401).json({error: "Please fill out all the fields."});
    }

    const newGroup = {
        id: nextGroupID++,
        game: game,
        description: description,
        maxPlayers: parseInt(maxPlayers),
        currentPlayers: 1,
        creator: username,
    }

    //INSERT INTO groups
    testGroups.push(newGroup);
    //remember to ask if we want to change the whole website to the creat Party interface or only a pop up window (dialog or whatever it is called)
    res.status(200).json({success: true});
})

app.delete("/groups/:id", requiredLogin, (req, res) => {
    const groupId = parseInt(req.params.id);
    const groupIndex = testGroups.findIndex(group => group.id === groupId);

    if(groupIndex === -1) {
        return res.status(404).json({error: "Group not found"});
    }
    const group = testGroups[groupIndex];
    if(group.creator !== req.session.user.creator){
        return res.status(401).json({error: "User not found"});
    }

    testGroups.splice(groupIndex, 1);
    res.status(200).json({success: true, message: "Group deleted successfully."});
})

app.put("/groups/:id", requiredLogin, (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const {description, maxPlayers} = req.body;
    const groupIndex = testGroups.findIndex(group => group.id === groupId);

    if(groupIndex === -1) {
        return res.status(404).json({error: "Group not found"});
    }

    const group = testGroups[groupIndex];

    if(group.creator !== req.session.user.creator){
        return res.status(403).json({error: "You can only edit your own groups"});
    }

    if(description){
        group.description = description;
    }

    if(maxPlayers){
        group.maxPlayers = parseInt(maxPlayers);
    }
    res.status(200).json({success: true, group: group, message: "Group updated successfully."});
})
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
