const express = require('express');
const db = require('../db');
const router = express.Router();

router.put('/profile', (req, res) => {
    const { displayName } = req.body;
    if (!displayName) return res.status(400).json({ error: 'displayName is required' });

    try {
        db.prepare("UPDATE users SET display_name = ? WHERE uid = ?").run(displayName, req.uid);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Failed to update profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

router.get('/profile', (req, res) => {
    try {
        const user = db.prepare('SELECT uid, display_name, email FROM users WHERE uid = ?').get(req.uid);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Failed to get profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

router.post('/find-or-create', (req, res) => {
    const { uid, displayName, email } = req.body;
    if (!uid || !displayName || !email) {
        return res.status(400).json({ error: 'uid, displayName, and email are required' });
    }

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

router.post('/api-key', (req, res) => {
    const { apiKey } = req.body;
    if (typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'API key must be a string' });
    }
    
    try {
        db.prepare("UPDATE users SET api_key = ? WHERE uid = ?").run(apiKey, req.uid);
    res.json({ message: 'API key saved successfully' });
    } catch (error) {
        console.error('Failed to save API key:', error);
        res.status(500).json({ error: 'Failed to save API key' });
    }
});

router.get('/api-key-status', (req, res) => {
    try {
        const row = db.prepare('SELECT api_key FROM users WHERE uid = ?').get(req.uid);
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ hasApiKey: !!row.api_key && row.api_key.length > 0 });
    } catch (error) {
        console.error('Failed to get API key status:', error);
        res.status(500).json({ error: 'Failed to get API key status' });
    }
});

router.delete('/profile', (req, res) => {
    try {
        const user = db.prepare('SELECT uid FROM users WHERE uid = ?').get(req.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
    }

        const userSessions = db.prepare('SELECT id FROM sessions WHERE uid = ?').all(user.uid);
        const sessionIds = userSessions.map(s => s.id);

        db.transaction(() => {
            if (sessionIds.length > 0) {
                const placeholders = sessionIds.map(() => '?').join(',');
                db.prepare(`DELETE FROM transcripts WHERE session_id IN (${placeholders})`).run(...sessionIds);
                db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
                db.prepare(`DELETE FROM summaries WHERE session_id IN (${placeholders})`).run(...sessionIds);
                db.prepare(`DELETE FROM sessions WHERE uid = ?`).run(user.uid);
            }
            db.prepare('DELETE FROM prompt_presets WHERE uid = ?').run(user.uid);
            db.prepare('DELETE FROM users WHERE uid = ?').run(user.uid);
        })();

        res.status(200).json({ message: 'User account and all data deleted successfully.' });

    } catch (error) {
        console.error('Failed to delete user account:', error);
        res.status(500).json({ error: 'Failed to delete user account' });
    }
});

async function getUserBatchData(req, res) {
    const { include = 'profile,presets,sessions' } = req.query;
    
    try {
    const includes = include.split(',').map(item => item.trim());
    const result = {};
    
    if (includes.includes('profile')) {
            const user = db.prepare('SELECT uid, display_name, email FROM users WHERE uid = ?').get(req.uid);
            result.profile = user || null;
    }
    
    if (includes.includes('presets')) {
            const presets = db.prepare('SELECT * FROM prompt_presets WHERE uid = ? OR is_default = 1').all(req.uid);
            result.presets = presets || [];
    }
    
        if (includes.includes('sessions')) {
        const recent_sessions = db.prepare(
                "SELECT id, title, started_at, updated_at FROM sessions WHERE uid = ? ORDER BY updated_at DESC LIMIT 10"
            ).all(req.uid);
            result.sessions = recent_sessions || [];
    }
    
    res.json(result);

    } catch (error) {
        console.error('Failed to get batch data:', error);
        res.status(500).json({ error: 'Failed to get batch data' });
    }
}

router.get('/batch', getUserBatchData);

module.exports = router;
