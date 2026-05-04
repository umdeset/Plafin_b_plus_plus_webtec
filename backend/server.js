require("dotenv").config();
const express = require('express');
//node:path tells node.js to ignore the node_modules folder
const path = require('node:path');
const bodyParser = require('body-parser');
const {DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;

const app = express();
const memory = {}


// Parse urlencoded bodies
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/status', (req, res) => {
    res.json({ message: "Ich sehe es auf port 3000" });
});


//exchange code for access token
//async because it needs to wait for an exteral server
app.post('/getToken', async (req, res) => {
    const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            code:req.body.code,
            grant_type: 'authorization_code',
            redirect_uri: "http://localhost:3000",
            scope: 'identify',
        }).toString(),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const oauthData = await tokenResponseData.json();
    return res.json(oauthData);
});

//exchange access Token for user
app.get("/p/getUser", async (req, res) => {
    const authString = req.headers.authorization;
    const me = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: authString,
        },
    })
    if (!me.ok) {
        return false;
    }
    const response = await me.json();

    const {id, username} = response;
    const coins = memory[id] || 0
    if (!coins) { memory[id] = 0 }
    const user = { id, username, coins }
    res.json(user)
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});