const express = require('express');
const { Worker } = require('worker_threads');
const path = require('path');
const { connectToDatabase, getTasksCollection, ObjectId } = require('../database/db');
const { authenticateToken } = require('./auth');

const app = express();
app.use(express.json());

let hasActiveTask = false;

app.get('/load', authenticateToken, async (req, res) => {
    try {
        let collection = await getTasksCollection();
        const tasks = await collection.find({ 
            server: serverUrl, 
            status: { $in: ['awaiting', 'in-progress'] } 
        }).toArray();
    
        let load = 0;
        for (const task of tasks) {
            load += Number(task.number);
        }

        res.json(load);
    } catch (error) {
        console.error('Error getting load', error);
        res.status(500).send('Error getting load');
    }
});

async function pickAssignedTasks() {
    const CHECK_INTERVAL = 1000;
    let collection = await getTasksCollection();
    if (hasActiveTask) {
        setTimeout(() => pickAssignedTasks(), CHECK_INTERVAL);
        return;
    }
    const task = await collection.findOneAndUpdate(
        { status: 'awaiting', server: `http://127.0.0.1:${port}` },
        { $set: { status: 'in-progress', startedAt: new Date() } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
    );

    if (!task.value) {
        console.log('No tasks value');
        setTimeout(() => pickAssignedTasks(), CHECK_INTERVAL);
        return;
    }

    hasActiveTask = true;
    const { number: n, _id: requestId } = task.value;
    console.log(`Picked task ${requestId} with n = ${n}`);
    
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
        workerData: { n: Number(n), requestId: requestId.toString() }
    });
    worker.on('message', async (result) => {
        if (result !== null) {
            await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { result, completedAt: new Date() } });
        }
        hasActiveTask = false;
        pickAssignedTasks();
    });
    worker.on('error', async (error) => {
        console.error('Worker error:', error);
        hasActiveTask = false;
        pickAssignedTasks();
    });
    worker.on('exit', async (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        hasActiveTask = false;
        pickAssignedTasks();
    });
}

const port = process.argv[2] || 3001;
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server running on port ${port}`);
    pickAssignedTasks();
});