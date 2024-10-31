const express = require('express');
const { Worker } = require('worker_threads');
const path = require('path');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');
const { authenticateToken } = require('./auth');

const app = express();
app.use(express.json());

let activeTasks = 0;

async function calculateLoad(serverUrl) {
    let collection = await getCollection();
    const tasks = await collection.find({ 
        server: serverUrl, 
        status: { $in: ['awaiting', 'in-progress'] } 
    }).toArray();

    let totalLoad = 0;
    for (const task of tasks) {
        const taskPoints = task.status === 'in-progress'
            ? Number(task.points) * (1 - task.progress / 100)
            : Number(task.points);

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

app.get('/progress/:id', authenticateToken, async (req, res) => {
    let collection = await getCollection();
    const request = await collection.findOne({ _id: new ObjectId(req.params.id) });
    res.json({ progress: request.progress });
});

function evaluateFunction(func, x) {
    return eval(func);
}

async function pickNextTasks() {
    let collection = await getCollection();

    if (activeTasks >= 3) {
        setTimeout(() => pickNextTasks(), 500);
        return;
    }

    for (let i = 0; i < 3 - activeTasks; i++) {
        const task = await collection.findOneAndUpdate(
            { status: 'awaiting', server: `http://127.0.0.1:${port}` },
            { $set: { status: 'in-progress', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );

        if (!task.value) {
            break;
        }

        activeTasks++;

        const { function: func, interval, points, _id: requestId } = task.value;
        const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
            workerData: { func, interval, points, requestId: requestId.toString() }
        });

        worker.on('message', async (result) => {
            if (result !== null) {
                await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { result, completedAt: new Date() } });
            }
            activeTasks--;
            pickNextTasks();
        });

        worker.on('error', async (error) => {
            console.error('Worker error:', error);
            activeTasks--;
            pickNextTasks();
        });

        worker.on('exit', async (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
            }
            activeTasks--;

            if (activeTasks > 3) {
                await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { status: 'awaiting' } });
                console.log(`Reverted task ${requestId} to awaiting`);
            }

            pickNextTasks();
        });
    }

    if (activeTasks < 3) {
        setTimeout(() => pickNextTasks(), 500);
    }
}

const port = process.argv[2] || 3001;
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server running on port ${port}`);
    pickNextTasks();
});