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
    router.get("/current-group", requiredLogin, async (req, res) => {
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
    return router;
}