const { parentPort, workerData } = require('worker_threads');
const { connectToDatabase, getCollection, ObjectId } = require('../database/db');

const PROGRESS_UPDATES_NUMBER = 100;
const CANCELLATION_CHECKS_NUMBER = 1000;

async function calculateTribonacci(n, requestId) {
    await connectToDatabase();
    const collection = await getCollection();
    if (n === 0) return BigInt(0);
    if (n === 1 || n === 2) return BigInt(1);
    let a = BigInt(0), b = BigInt(1), c = BigInt(1), result = BigInt(0);
    
    for (let i = 3; i <= n; i++) {
        result = a + b + c;
        a = b;
        b = c;
        c = result;
        const progress = Math.floor((i / n) * 100);
        if (i % Math.floor(n / PROGRESS_UPDATES_NUMBER) === 0) {
            await collection.updateOne({ _id: new ObjectId(requestId) }, { $set: { progress } });
        }
        if (i % Math.floor(n / CANCELLATION_CHECKS_NUMBER) === 0) {
            const task = await collection.findOne({ _id: new ObjectId(requestId) });
            if (task.status === 'cancelled') {
                return null;
            }
        }
    }
    const resultString = c.toString().length > 15 
        ? `${c.toString()[0]}.${c.toString().slice(1, 15)}E+${c.toString().length - 1}` 
        : c.toString();
    await collection.updateOne(
        { _id: new ObjectId(requestId) },
        { $set: { progress: 100, status: 'completed', completedAt: new Date(), result: resultString } }
    );
    return resultString;
}

(async () => {
    const { n, requestId } = workerData;
    try {
        await connectToDatabase();
        const result = await calculateTribonacci(n, requestId);
        parentPort.postMessage(result);
    } catch (error) {
        parentPort.postMessage(null);
        console.error('Worker error:', error);
    }
})();