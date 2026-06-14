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
                tags VARCHAR(255) DEFAULT '',
                image_url VARCHAR(500),
                FOREIGN KEY (creator_username) REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE
            );
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                image_url VARCHAR(500)
            );
            CREATE TABLE IF NOT EXISTS group_members (
                group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id)
            );
        `);
        await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMP;
`);
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL;
        `);
        console.log('Database Ready');
        return client;
    }catch(err){
        console.error("Database conection failed: ",err);
        process.exit(1);
    }
}
module.exports = connectDB;