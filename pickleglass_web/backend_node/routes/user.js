const express = require('express');
const db = require('../db');
const { createValidationMiddleware } = require('../middleware/validation');
const { createRateLimitMiddleware } = require('../middleware/rateLimiting');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.put('/profile', 
    createRateLimitMiddleware('profile'),
    createValidationMiddleware('updateProfile'),
    (req, res) => {
        const { displayName } = req.body;
        
        try {
            db.prepare("UPDATE users SET display_name = ? WHERE uid = ?").run(displayName, req.uid);
            res.json({ message: 'Profile updated successfully' });
        } catch (error) {
            console.error('Failed to update profile:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    });

router.get('/profile', async (req, res) => {
    try {
        const user = await ipcRequest(req, 'get-user-profile');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Failed to get profile via IPC:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

router.post('/find-or-create', 
    createRateLimitMiddleware('auth'),
    createValidationMiddleware('createUser'),
    (req, res) => {
        const { uid, displayName, email } = req.body;

        try {
            const now = Math.floor(Date.now() / 1000);
            db.prepare(
                `INSERT INTO users (uid, display_name, email, created_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(uid) DO NOTHING`
            ).run(uid, displayName, email, now);
            
            const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
            res.status(200).json(user);

        } catch (error) {
            console.error('Failed to find or create user:', error);
            res.status(500).json({ error: 'Failed to find or create user' });
        }
    });

router.post('/api-key', 
    createRateLimitMiddleware('profile'),
    createValidationMiddleware('apiKey'),
    (req, res) => {
        const { apiKey } = req.body;
        
        try {
            db.prepare("UPDATE users SET api_key = ? WHERE uid = ?").run(apiKey, req.uid);
            res.json({ message: 'API key saved successfully' });
        } catch (error) {
            console.error('Failed to save API key:', error);
            res.status(500).json({ error: 'Failed to save API key' });
        }
    });

router.get('/api-key-status', async (req, res) => {
    try {
        const status = await ipcRequest(req, 'check-api-key-status');
        res.json(status);
    } catch (error) {
        console.error('Failed to get API key status via IPC:', error);
        res.status(500).json({ error: 'Failed to get API key status' });
    }
});

router.delete('/profile', async (req, res) => {
    try {
        await ipcRequest(req, 'delete-account');
        res.status(200).json({ message: 'User account and all data deleted successfully.' });
    } catch (error) {
        console.error('Failed to delete user account via IPC:', error);
        res.status(500).json({ error: 'Failed to delete user account' });
    }
});

router.get('/batch', 
    createRateLimitMiddleware('general'),
    createValidationMiddleware('batchQuery'),
    async (req, res) => {
        try {
            const result = await ipcRequest(req, 'get-batch-data', req.query.include);
            res.json(result);
        } catch(error) {
            console.error('Failed to get batch data via IPC:', error);
            res.status(500).json({ error: 'Failed to get batch data' });
        }
    });

module.exports = router;
