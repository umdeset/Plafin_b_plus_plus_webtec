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


app.get('/dashboard', (req, res) => {
    if(req.session.user) {
        res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
    }else{
        res.redirect('/');
    }
});


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

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});