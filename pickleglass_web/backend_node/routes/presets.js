const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
    try {
        const presets = db.prepare(
            `SELECT * FROM prompt_presets 
             WHERE uid = ? OR is_default = 1 
             ORDER BY is_default DESC, title ASC`
        ).all(req.uid);
        res.json(presets);
    } catch (error) {
        console.error('Failed to get presets:', error);
        res.status(500).json({ error: 'Failed to retrieve presets' });
    }
});

router.post('/', (req, res) => {
    const { title, prompt } = req.body;
    if (!title || !prompt) {
        return res.status(400).json({ error: 'Title and prompt are required' });
    }

    const presetId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    try {
        db.prepare(
            `INSERT INTO prompt_presets (id, uid, title, prompt, is_default, created_at, sync_state)
             VALUES (?, ?, ?, ?, 0, ?, 'dirty')`
        ).run(presetId, req.uid, title, prompt, now);

        res.status(201).json({ id: presetId, message: 'Preset created successfully' });
    } catch (error) {
        console.error('Failed to create preset:', error);
        res.status(500).json({ error: 'Failed to create preset' });
    }
});

router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { title, prompt } = req.body;
    if (!title || !prompt) {
        return res.status(400).json({ error: 'Title and prompt are required' });
    }

    try {
        const result = db.prepare(
            `UPDATE prompt_presets 
             SET title = ?, prompt = ?, sync_state = 'dirty'
             WHERE id = ? AND uid = ? AND is_default = 0`
        ).run(title, prompt, id, req.uid);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Preset not found or you don't have permission to edit it." });
        }

        res.json({ message: 'Preset updated successfully' });
    } catch (error) {
        console.error('Failed to update preset:', error);
        res.status(500).json({ error: 'Failed to update preset' });
    }
});

router.delete('/:id', (req, res) => {
    const { id } = req.params;

    try {
        const result = db.prepare(
            `DELETE FROM prompt_presets 
             WHERE id = ? AND uid = ? AND is_default = 0`
        ).run(id, req.uid);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Preset not found or you don't have permission to delete it." });
        }

        res.json({ message: 'Preset deleted successfully' });
    } catch (error) {
        console.error('Failed to delete preset:', error);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});

module.exports = router; 