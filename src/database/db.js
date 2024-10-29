const { MongoClient, ObjectId } = require('mongodb');

const client = new MongoClient('mongodb://localhost:27017', { useUnifiedTopology: true });
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