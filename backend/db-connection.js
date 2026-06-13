const {Client} = require('pg');
const config = require('./config');

async function connectDB() {
    const client = new Client({
        connectionString: config.postgresURI,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try{
        await client.connect();
        console.log('Connected to DB');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                discord_id VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                game VARCHAR(255) NOT NULL,
                title VARCHAR(255) DEFAULT 'Gaming Lounge',
                description TEXT NOT NULL,
                max_players INTEGER NOT NULL,
                current_players INTEGER DEFAULT 1,
                creator_username VARCHAR(255) NOT NULL,
                tags VARCHAR(255) DEFAULT '', -- Für Leute, die die DB in Zukunft komplett neu aufsetzen
                FOREIGN KEY (creator_username) REFERENCES users(username) ON DELETE CASCADE
            );
        `);
        console.log('Database Ready');
        return client;
    }catch(err){
        console.error("Database conection failed: ",err);
        process.exit(1);
    }
}
module.exports = connectDB;