const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.get('/', async (req, res) => {
    try {
        const sessions = await ipcRequest(req, 'get-sessions');
        res.json(sessions);
    } catch (error) {
        console.error('Failed to get sessions via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});

router.post('/', async (req, res) => {
    try {
        const result = await ipcRequest(req, 'create-session', req.body);
        res.status(201).json({ ...result, message: 'Session created successfully' });
    } catch (error) {
        console.error('Failed to create session via IPC:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

router.get('/:session_id', async (req, res) => {
    try {
        const details = await ipcRequest(req, 'get-session-details', req.params.session_id);
        if (!details) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(details);
    } catch (error) {
        console.error(`Failed to get session details via IPC for ${req.params.session_id}:`, error);
        res.status(500).json({ error: 'Failed to retrieve session details' });
    }
});

router.delete('/:session_id', async (req, res) => {
    try {
        await ipcRequest(req, 'delete-session', req.params.session_id);
        res.status(200).json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error(`Failed to delete session via IPC for ${req.params.session_id}:`, error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// The search functionality will be more complex to move to IPC.
// For now, we can disable it or leave it as is, knowing it's a future task.
router.get('/search', (req, res) => {
    res.status(501).json({ error: 'Search not implemented for IPC bridge yet.' });
});

module.exports = router; 