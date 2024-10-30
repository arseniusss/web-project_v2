const { parentPort, workerData } = require('worker_threads');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');

async function integrate(func, interval, points, requestId) {
    await connectToDatabase(); // Ensure the database connection is established
    const collection = await getCollection();
    console.log(`Integrating ${requestId}`);
    const [a, b] = interval.split(',').map(Number);
    const n = parseInt(points);
    const h = (b - a) / n;
    
    let sum = 0.5 * (evaluateFunction(func, a) + evaluateFunction(func, b));
    let progress = 0;
    for (let i = 1; i < n; i++) {
        sum += evaluateFunction(func, a + i * h);
        progress = Math.floor((i / n) * 100);
        if (i % Math.floor(n / 100) === 0) {
            await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { progress } });
        }
        if (i % Math.floor(n/1000) === 0)
        {
            const task = await collection.findOne({ _id: new ObjectId(requestId) });
            if (task.status === 'cancelled') {
                return null;
            }
        }
    }
    await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { progress: 100, status: 'completed', completedAt: new Date(), result: sum * h } });
    return sum * h;
}

function evaluateFunction(func, x) {
    return eval(func);
}

(async () => {
    const { func, interval, points, requestId } = workerData;
    try {
        await connectToDatabase(); // Ensure the database connection is established
        const result = await integrate(func, interval, points, requestId);
        parentPort.postMessage(result);
    } catch (error) {
        parentPort.postMessage(null);
        console.error('Worker error:', error);
    }
})();