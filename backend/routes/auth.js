const express = require('express');
const router = express.Router();

module.exports = (db, config) => {
    //-----------------------------------------------------------FOR GOOGLE-------------------------------------------------------------------------------------
    router.post('/google', async (req, res) => {
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

    //-----------------------------------------------------------FOR DISCORD-------------------------------------------------------------------------------------
//exchange code for access token
//async because it needs to wait for an exteral server
    router.post('/discord', async (req, res) => {
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
    return router;
}