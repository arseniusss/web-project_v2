const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { connectToDatabase, getTasksCollection, ObjectId } = require('../database/db');
const { authRouter, authenticateToken } = require('./auth');
const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);

const servers = ['http://127.0.0.1:3001','http://127.0.0.1:3002', 'http://127.0.0.1:3003'];

app.post('/calculate_tribonacci', authenticateToken, async (req, res) => {
    const MAX_CONCURRENT_TASKS_FOR_USER = 6;

    const { number } = req.body;
    const userId = req.user.userId;
    const collection = getTasksCollection();

    if (!collection) {
        return res.status(500).send('Database connection not established');
    }

    const ongoingTasks = await collection.countDocuments({ userId, status: { $in: ['awaiting', 'in-progress'] } });
    if (ongoingTasks >= MAX_CONCURRENT_TASKS_FOR_USER) {
        return res.json({ message: `You have more than ${MAX_CONCURRENT_TASKS_FOR_USER} ongoing tasks. Please wait for some tasks to complete.` });
    }

    const leastLoadedServer = await pickLeastLoadedServer(req);
    if (!leastLoadedServer) {
        return res.status(500).send('No available servers');
    }

    const requestId = (await collection.insertOne({
        userId,
        number,
        server: leastLoadedServer,
        status: 'awaiting',
        createdAt: new Date(),
        progress: 0
    })).insertedId;

    res.json({ requestId });
});

app.get('/tasks', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const collection = getTasksCollection();
    const tasks = await collection.find({ userId }).toArray();
    res.json(tasks);
});

app.post('/cancel-task/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const collection = getTasksCollection();
    if (!collection) {
        return res.status(500).send('Database connection not established');
    }
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled' } });
    await rebalanceTasks(req);
    res.sendStatus(200);
});

app.get('/server-loads', authenticateToken, async (req, res) => {
    const serverLoads = await Promise.all(servers.map(async (server) => {
        try {
            const response = await axios.get(`${server}/load`, {
                headers: {
                    'Authorization': req.headers.authorization
                }
            });
            return { server, load: response.data };
        } catch (error) {
            console.error(`Error pinging server ${server}:`, error);
            return { server, load: null };
        }
    }));
    res.json(serverLoads);
});

async function pickLeastLoadedServer(req) {
    let minLoad = Infinity;
    let leastLoadedServer = null;

    for (const server of servers) {
        try {
            const response = await axios.get(`${server}/load`, {
                headers: {
                    'Authorization': req.headers.authorization
                }
            });
            if (response.data < minLoad) {
                minLoad = response.data;
                leastLoadedServer = server;
            }
        } catch (error) {
            console.error(`Error pinging server ${server}:`, error);
        }
    }
    return leastLoadedServer;
}

async function rebalanceTasks(req) {
    const collection = getTasksCollection();
    const awaitingTasks = await collection.find({ status: 'awaiting' }).toArray();

    for (const task of awaitingTasks) {
        const server = await pickLeastLoadedServer(req);
        if (server) {
            await collection.updateOne({ _id: task._id }, { $set: { server } });
        }
    }
}

app.use(express.static(path.join(__dirname, '../frontend/public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

connectToDatabase().then(() => {
    app.listen(5000, () => console.log('Load balancer running on port 5000'));
}).catch(error => {
    console.error('Failed to connect to the database', error);
});