const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI, { useUnifiedTopology: true });
let db;
let tasksCollection;
let usersCollection;

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        db = client.db('tribonacci');
        tasksCollection = db.collection('requests');
        usersCollection = db.collection('users');
        console.log('Connected to MongoDB');
    }
    return { db, tasksCollection };
}

module.exports = {
    connectToDatabase,
    getDb: () => db,
    getTasksCollection: () => tasksCollection,
    getUsersCollection: () => usersCollection,
    ObjectId
};