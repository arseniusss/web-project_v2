const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI, { useUnifiedTopology: true });
let db;
let collection;
let usersCollection;

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        db = client.db('integration');
        collection = db.collection('requests');
        usersCollection = db.collection('users');
        console.log('Connected to MongoDB');
    }
    return { db, collection };
}

module.exports = {
    connectToDatabase,
    getDb: () => db,
    getCollection: () => collection,
    getUsersCollection: () => usersCollection,
    ObjectId
};