const express = require('express');
const router = express.Router();

const requiredLogin = (req, res, next) => {
    if(req.session.user) {
        next();
    }else{
        res.status(401).send('Not logged in');
    }
}

module.exports = (db, io) => {
    router.get("/", async (req, res) => {
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
            res.status(200).sendData(result.rows);
        }catch(err){
            console.error("Error fetching groups from database:", err);
            res.status(500).sendData({error: "Internal Server Error"});
        }
    });

    //create groups
    router.post("/", requiredLogin, async (req, res) => {
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
    });

    router.delete("/:id", requiredLogin, async (req, res) => {
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

    //update lobby
    router.patch("/:id", requiredLogin, async (req, res) => {
        const groupId = parseInt(req.params.id, 10);
        const {game, description, max_players, title} = req.body;
        const creator_username = req.session.user.username;

        try{
            const query = `
            UPDATE groups 
            SET 
                game = COALESCE($1, game),
                description = COALESCE($2, description),
                max_players = COALESCE($3, max_players),
                title = COALESCE($4, title)
            WHERE id = $5 AND creator_username = $6
            RETURNING id, game, description, max_players, title, current_players, creator_username;
        `;

            const data = await db.query('SELECT current_players FROM groups WHERE id = $1 AND creator_username = $2', [groupId, creator_username]);
            const group = data.rows[0];

            if(max_players < group.current_players){
                return res.status(400).json({error: "There are to many players in your group"});
            }
            const values = [game || null, description || null, max_players ? parseInt(max_players) : null, title || null, groupId, creator_username];
            const result = await db.query(query, values);

            if(result.rowCount === 0){
                return res.status(404).json({error: "Could not find group"});
            }

            res.status(200).json({success: true, group: result.rows[0], message: "Group updated successfully."});
        }catch(err){
            console.error("Error update group:", err);
            res.status(500).json({error: "Internal Server Error"});
        }
    });

    router.post("/:id/join", requiredLogin, async (req, res) => {
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

            io.to(groupId.toString()).emit('updatePlayerList')

            io.emit('lobbiesChanged');

            res.status(200).json({success: true, message: "You successfully joined the group!", group: updatedGroup.rows[0]});

        }catch(err){
            console.error("Error joining group:", err);
            res.status(500).json({error: "Internal Server Error"});
        }
    });

    router.delete("/:id/leave", requiredLogin, async (req, res) => {
        const groupId = parseInt(req.params.id, 10);
        const userId = req.session.user.id;
        const username = req.session.user.username


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

            const request = await db.query('SELECT current_players, creator_username FROM groups WHERE id = $1',[groupId]);
            const remainingPlayers = request.rows[0].current_players
            const creator = request.rows[0].creator_username
            if(remainingPlayers === 0 || creator === username){
                const query = `
            DELETE FROM groups 
            WHERE id = $1
            `;

                await db.query(query, [groupId]);
            }

            io.to(groupId.toString()).emit('updatePlayerList')

            io.emit('lobbiesChanged');

            res.status(200).json({success: true, message: "You successfully left the group!", group: updatedGroup.rows[0]});

        }catch(err){
            console.error("Error leaving group:", err);
            res.status(500).json({error: "Internal Server Error"});
        }
    });

    router.get("/:id/members", requiredLogin, async (req, res) => {
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
            res.status(200).sendData(result.rows);
        }catch(err){
            console.error("Error fetching group members", err);
            res.status(500).json({error: "Internal Server Error"});
        }
    })

    router.get("/:id/info", requiredLogin, async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({error: "Lobby not found"});
            res.status(200).sendData(result.rows[0]);
        } catch (err) {
            res.status(500).json({error: "Internal Server Error"});
        }
    });

    router.get('/:game', requiredLogin, (req, res) => {
        const game = req.params.game;
        res.redirect(`/lobbies.html?game=${encodeURIComponent(game)}`);

    });


    return router;
};