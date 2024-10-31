require('dotenv').config();

const config = {
    mongodbUri: process.env.MONGODB_URI,
    secretKey: process.env.SECRET_KEY,
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
    servers: process.env.SERVERS ? process.env.SERVERS.split(',') : ['http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003']
};

module.exports = config;