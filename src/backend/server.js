const express = require('express');
const { Worker } = require('worker_threads');
const path = require('path');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');
const { authenticateToken } = require('./auth');

const app = express();
app.use(express.json());

let activeTask = false;

async function calculateLoad(serverUrl) {
    let collection = await getCollection();
    const tasks = await collection.find({ 
        server: serverUrl, 
        status: { $in: ['awaiting', 'in-progress'] } 
    }).toArray();

    let totalLoad = 0;
    for (const task of tasks) {
        const taskPoints = task.status === 'in-progress'
            ? Number(task.number) * (1 - task.progress / 100)
            : Number(task.number);

        totalLoad += taskPoints;
    }
    return totalLoad;
}

app.get('/load', authenticateToken, async (req, res) => {
    try {
        const load = await calculateLoad(`http://127.0.0.1:${port}`);
        res.json(load);
    } catch (error) {
        console.error('Error getting load', error);
        res.status(500).send('Error getting load');
    }
});

async function pickNextTasks() {
    let collection = await getCollection();
    if (activeTask) {
        setTimeout(() => pickNextTasks(), 500);
        return;
    }
    const task = await collection.findOneAndUpdate(
        { status: 'awaiting', server: `http://127.0.0.1:${port}` },
        { $set: { status: 'in-progress', startedAt: new Date() } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
    );
    if (!task.value) {
        setTimeout(() => pickNextTasks(), 500);
        return;
    }
    activeTask = true;
    const { number: n, _id: requestId } = task.value;
    console.log(`Picked task ${requestId} with n = ${n}`);
    
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
        workerData: { n: Number(n), requestId: requestId.toString() }
    });
    worker.on('message', async (result) => {
        if (result !== null) {
            await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { result, completedAt: new Date() } });
        }
        activeTask = false;
        pickNextTasks();
    });
    worker.on('error', async (error) => {
        console.error('Worker error:', error);
        activeTask = false;
        pickNextTasks();
    });
    worker.on('exit', async (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        activeTask = false;
        pickNextTasks();
    });
}

const port = process.argv[2] || 3001;
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server running on port ${port}`);
    pickNextTasks();
});