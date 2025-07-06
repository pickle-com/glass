const express = require('express');
const db = require('../db');
const router = express.Router();
const crypto = require('crypto');
const { createValidationMiddleware } = require('../middleware/validation');
const { createRateLimitMiddleware } = require('../middleware/rateLimiting');

router.get('/', (req, res) => {
    try {
        const sessions = db.prepare(
            "SELECT id, uid, title, session_type, started_at, ended_at, sync_state, updated_at FROM sessions WHERE uid = ? ORDER BY started_at DESC"
        ).all(req.uid);
        res.json(sessions);
    } catch (error) {
        console.error('Failed to get sessions:', error);
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

router.get('/:session_id', (req, res) => {
    const { session_id } = req.params;
    try {
        const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session_id);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const transcripts = db.prepare("SELECT * FROM transcripts WHERE session_id = ? ORDER BY start_at ASC").all(session_id);
        const ai_messages = db.prepare("SELECT * FROM ai_messages WHERE session_id = ? ORDER BY sent_at ASC").all(session_id);
        const summary = db.prepare("SELECT * FROM summaries WHERE session_id = ?").get(session_id);

        res.json({
            session,
            transcripts,
            ai_messages,
            summary: summary || null
        });
    } catch (error) {
        console.error(`Failed to get session ${session_id}:`, error);
        res.status(500).json({ error: 'Failed to retrieve session details' });
    }
});

router.delete('/:session_id', (req, res) => {
    const { session_id } = req.params;
    
    const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(session_id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        db.transaction(() => {
            db.prepare("DELETE FROM transcripts WHERE session_id = ?").run(session_id);
            db.prepare("DELETE FROM ai_messages WHERE session_id = ?").run(session_id);
            db.prepare("DELETE FROM summaries WHERE session_id = ?").run(session_id);
            db.prepare("DELETE FROM sessions WHERE id = ?").run(session_id);
        })();
        res.status(200).json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error(`Failed to delete session ${session_id}:`, error);
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