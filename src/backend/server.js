const express = require('express');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');
const { authenticateToken } = require('./auth');

const app = express();
app.use(express.json());

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

async function integrate(func, interval, points, collection, requestId) {
    console.log('Integrating...');
    const [a, b] = interval.split(',').map(Number);
    const n = parseInt(points);
    const h = (b - a) / n;

    let sum = 0.5 * (evaluateFunction(func, a) + evaluateFunction(func, b));
    let progress = 0;

    for (let i = 1; i < n; i++) {
        sum += evaluateFunction(func, a + i * h);
        progress = Math.floor((i / n) * 100);

        if (i % Math.floor(n / 100) === 0) {
            await collection.updateOne({ _id: requestId }, { $set: { progress } });
        }
        
        // перемістити
        const task = await collection.findOne({ _id: requestId });
        if (task.status === 'cancelled') {
            return null;
        }
    }

    await collection.updateOne({ _id: requestId }, { $set: { progress: 100, status: 'completed', completedAt: new Date(), result: sum * h } });
    return sum * h;
}

function evaluateFunction(func, x) {
    return eval(func);
}

async function pickNextTask() {
    let collection = getCollection();
    console.log('Picking next task...');
    const nextTask = await collection.findOneAndUpdate(
        { status: 'awaiting', server: `http://127.0.0.1:${port}` },
        { $set: { status: 'in-progress' } },
        { sort: { createdAt: 1 } }
    );

    if (nextTask.value) {
        const { function: func, interval, points, _id: requestId } = nextTask.value;
        integrate(func, interval, points, collection, requestId)
            .then(result => {
                if (result !== null) {
                    collection.updateOne({ _id: requestId }, { $set: { result, completedAt: new Date() } });
                }
                setTimeout(() => pickNextTask(), 500);
            })
            .catch(error => {
                console.error('Error processing next task', error);
                setTimeout(() => pickNextTask(), 500);
            });
    } else {
        setTimeout(() => pickNextTask(), 500);
    }
}

const port = process.argv[2] || 3001;
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server running on port ${port}`);
    pickNextTask();
});