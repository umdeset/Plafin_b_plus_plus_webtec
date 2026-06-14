// Load .env file into process.env
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Load configuration from environment variables
module.exports = {
    port: parseInt(process.env.PORT || '3000', 10),
    discord_Client_ID: process.env.DISCORD_CLIENT_ID || '',
    discord_Client_Secret: process.env.DISCORD_CLIENT_SECRET || 'your-secret-key',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    JWT_SECRET: process.env.JWT_SECRET || 'JWT-secretkey',
    postgresURI: process.env.POSTGRES_URI,
    RAWG_API_KEY: process.env.RAWG_API_KEY
};
