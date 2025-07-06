const express = require('express');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');
const crypto = require('crypto');
const { createValidationMiddleware } = require('../middleware/validation');
const { createRateLimitMiddleware } = require('../middleware/rateLimiting');

router.get('/', async (req, res) => {
    try {
        const sessions = await ipcRequest(req, 'get-sessions');
        res.json(sessions);
    } catch (error) {
        console.error('Failed to get sessions via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
});

router.post('/', 
    createRateLimitMiddleware('inputHeavy'),
    createValidationMiddleware('createConversation'),
    (req, res) => {
        const { title } = req.body;
        const sessionId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        try {
            db.prepare(
                `INSERT INTO sessions (id, uid, title, started_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`
            ).run(sessionId, req.uid, title || 'New Conversation', now, now);

            res.status(201).json({ id: sessionId, message: 'Session created successfully' });
        } catch (error) {
            console.error('Failed to create session:', error);
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

router.get('/search', 
    createRateLimitMiddleware('search'),
    createValidationMiddleware('search'),
    (req, res) => {
        const { q } = req.query;
        
        try {
            const searchQuery = `%${q}%`;
            const sessionIds = db.prepare(`
                SELECT DISTINCT session_id FROM (
                    SELECT session_id FROM transcripts WHERE text LIKE ?
                    UNION
                    SELECT session_id FROM ai_messages WHERE content LIKE ?
                    UNION
                    SELECT session_id FROM summaries WHERE text LIKE ? OR tldr LIKE ?
                )
            `).all(searchQuery, searchQuery, searchQuery, searchQuery).map(row => row.session_id);

            if (sessionIds.length === 0) {
                return res.json([]);
            }

            const placeholders = sessionIds.map(() => '?').join(',');
            const sessions = db.prepare(
                `SELECT id, uid, title, started_at, ended_at, sync_state, updated_at FROM sessions WHERE id IN (${placeholders}) ORDER BY started_at DESC`
            ).all(sessionIds);

            res.json(sessions);
        } catch (error) {
            console.error('Search failed:', error);
            res.status(500).json({ error: 'Failed to perform search' });
        }
    });

module.exports = router; 