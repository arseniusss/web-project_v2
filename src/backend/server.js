const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

const client = new MongoClient('mongodb://localhost:27017', { useUnifiedTopology: true });
let db;
let collection;

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        db = client.db('integration');
        collection = db.collection('requests');
        console.log('Connected to MongoDB');
    }
    return collection;
}

async function calculateLoad(collection, serverUrl) {
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

app.get('/tasks', async (req, res) => {
    const collection = await connectToDatabase();
    const tasks = await collection.find({}).toArray();
    res.json(tasks);
});

app.get('/load', async (req, res) => {
    try {
        const collection = await connectToDatabase();
        const load = await calculateLoad(collection, `http://127.0.0.1:${port}`);
        res.json(load);
    } catch (error) {
        console.error('Error getting load', error);
        res.status(500).send('Error getting load');
    }
});

app.get('/progress/:id', async (req, res) => {
    const collection = await connectToDatabase();
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
            console.log('updated server load')
        }

        const task = await collection.findOne({ _id: requestId });
        if (task.status === 'cancelled') {
            return null;
        }
    }

    await collection.updateOne({ _id: requestId }, { $set: { progress: 100, status: 'completed', completedAt: new Date(), result: sum * h } });
    return sum * h;
}


function evaluateFunction(func, x) {
    return Function('x', `return (${func})`)(x);
}

async function pickNextTask(collection) {
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
                setTimeout(() => pickNextTask(collection), 500);
            })
            .catch(error => {
                console.error('Error processing next task', error);
                setTimeout(() => pickNextTask(collection), 500);
            });
    } else {
        setTimeout(() => pickNextTask(collection), 500);
    }
}

const port = process.argv[2] || 3001;
app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    const collection = await connectToDatabase();
    pickNextTask(collection);
});