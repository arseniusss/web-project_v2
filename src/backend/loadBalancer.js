const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');
const authRouter = require('./auth');
const app = express();
app.use(cors());
app.use(express.json());

const servers = ['http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003'];

async function getLeastLoadedServer() {
    let minLoad = Infinity;
    let selectedServer = null;

    for (const server of servers) {
        try {
            const response = await axios.get(`${server}/load`);
            if (response.data < minLoad) {
                minLoad = response.data;
                selectedServer = server;
            }
        } catch (error) {
            console.error(`Error pinging server ${server}:`, error);
        }
    }

    return selectedServer;
}

async function reassignAwaitingTasks() {
    const collection = getCollection();
    const awaitingTasks = await collection.find({ status: 'awaiting' }).toArray();

    for (const task of awaitingTasks) {
        const server = await getLeastLoadedServer();
        if (server) {
            await collection.updateOne({ _id: task._id }, { $set: { server } });
        }
    }
}

app.get('/server-loads', async (req, res) => {
    const serverLoads = await Promise.all(servers.map(async (server) => {
        try {
            const response = await axios.get(`${server}/load`);
            return { server, load: response.data };
        } catch (error) {
            console.error(`Error pinging server ${server}:`, error);
            return { server, load: null };
        }
    }));
    res.json(serverLoads);
});

app.use('/auth', authRouter);

app.post('/integrate', async (req, res) => {
    const { userId, function: func, interval, points } = req.body;
    const collection = getCollection();

    if (!collection) {
        return res.status(500).send('Database connection not established');
    }

    const ongoingTasks = await collection.countDocuments({ userId, status: { $in: ['awaiting', 'in-progress'] } });
    if (ongoingTasks >= 10) {
        return res.json({ message: 'You have more than 10 ongoing tasks. Please wait for some tasks to complete.' });
    }

    const server = await getLeastLoadedServer();
    if (!server) {
        return res.status(500).send('No available servers');
    }

    const requestId = (await collection.insertOne({
        userId,
        function: func,
        interval,
        points,
        server,
        status: 'awaiting',
        createdAt: new Date(),
        progress: 0
    })).insertedId;

    res.json({ requestId });
});

app.get('/tasks', async (req, res) => {
    const collection = getCollection();
    if (!collection) {
        return res.status(500).send('Database connection not established');
    }
    const tasks = await collection.find({}).toArray();
    res.json(tasks);
});

app.post('/cancel/:id', async (req, res) => {
    const { id } = req.params;
    const collection = getCollection();
    if (!collection) {
        return res.status(500).send('Database connection not established');
    }
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled' } });
    await reassignAwaitingTasks();
    res.sendStatus(200);
});

app.use(express.static(path.join(__dirname, '../frontend/public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

connectToDatabase().then(() => {
    app.listen(5000, () => console.log('Load balancer running on port 5000'));
}).catch(error => {
    console.error('Failed to connect to the database', error);
});