const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');


const app = express();

// Parse urlencoded bodies
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/status', (req, res) => {
    res.json({ message: "Ich sehe es auf port 3000" });
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});