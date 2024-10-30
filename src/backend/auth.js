const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getUsersCollection } = require('../database/db');
const authRouter = express.Router();

const SECRET_KEY = 'someverysecretkeyshouldbemovedtodotenv';

authRouter.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const usersCollection = getUsersCollection();

    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
        return res.status(400).send('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCollection.insertOne({ username, password: hashedPassword });
    const userId = result.insertedId;

    res.status(201).json({ userId });
});

authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const usersCollection = getUsersCollection();

    const user = await usersCollection.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Invalid credentials');
    }

    const accessToken = jwt.sign({ userId: user._id, username }, SECRET_KEY, { expiresIn: '1m' });
    const refreshToken = jwt.sign({ userId: user._id, username }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ accessToken, refreshToken });
});

authRouter.post('/token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);

        const accessToken = jwt.sign({ userId: user.userId, username: user.username }, SECRET_KEY, { expiresIn: '1m' });
        res.json({ accessToken });
    });
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

module.exports = { authRouter, authenticateToken };