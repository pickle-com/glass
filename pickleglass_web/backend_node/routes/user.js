const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.put('/profile', async (req, res) => {
    try {
        await ipcRequest(req, 'update-user-profile', req.body);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Failed to update profile via IPC:', error);
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

router.post('/find-or-create', async (req, res) => {
    try {
        console.log('[API] find-or-create request received:', req.body);
        
        if (!req.body || !req.body.uid) {
            return res.status(400).json({ error: 'User data with uid is required' });
        }
        
        const user = await ipcRequest(req, 'find-or-create-user', req.body);
        console.log('[API] find-or-create response:', user);
        res.status(200).json(user);
    } catch (error) {
        console.error('Failed to find or create user via IPC:', error);
        console.error('Request body:', req.body);
        res.status(500).json({ 
            error: 'Failed to find or create user',
            details: error.message 
        });
    }
});

router.post('/api-key', async (req, res) => {
    try {
        const { apiKey, provider = 'openai' } = req.body;
        await ipcRequest(req, 'save-api-key', { apiKey, provider });
        res.json({ message: 'API key saved successfully' });
    } catch (error) {
        console.error('Failed to save API key via IPC:', error);
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

router.get('/batch', async (req, res) => {
    try {
        const result = await ipcRequest(req, 'get-batch-data', req.query.include);
        res.json(result);
    } catch(error) {
        console.error('Failed to get batch data via IPC:', error);
        res.status(500).json({ error: 'Failed to get batch data' });
    }
});

module.exports = router;
