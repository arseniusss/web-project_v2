const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getCollection } = require('../database/db');
const router = express.Router();

const SECRET_KEY = 'someverysecretkeyshouldbemovedtodotenv';

router.post('/signup', async (req, res) => {
    console.log('signup')
    const { username, password } = req.body;
    const collection = getCollection();

    const hashedPassword = await bcrypt.hash(password, 10);
    await collection.insertOne({ username, password: hashedPassword });

    res.sendStatus(201);
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const collection = getCollection();

    const user = await collection.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Invalid credentials');
    }

    const accessToken = jwt.sign({ username }, SECRET_KEY, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ username }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ accessToken, refreshToken });
});

router.post('/token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);

        const accessToken = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '15m' });
        res.json({ accessToken });
    });
});

module.exports = router;