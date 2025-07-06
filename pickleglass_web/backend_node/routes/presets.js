const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { createValidationMiddleware } = require('../middleware/validation');
const { createRateLimitMiddleware } = require('../middleware/rateLimiting');
const router = express.Router();
const { ipcRequest } = require('../ipcBridge');

router.get('/', async (req, res) => {
    try {
        const presets = await ipcRequest(req, 'get-presets');
        res.json(presets);
    } catch (error) {
        console.error('Failed to get presets via IPC:', error);
        res.status(500).json({ error: 'Failed to retrieve presets' });
    }
});

router.post('/', 
    createRateLimitMiddleware('inputHeavy'),
    createValidationMiddleware('createPreset'),
    (req, res) => {
        const { title, prompt } = req.body;

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

router.put('/:id', 
    createRateLimitMiddleware('inputHeavy'),
    createValidationMiddleware('createPreset'),
    (req, res) => {
        const { id } = req.params;
        const { title, prompt } = req.body;

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

router.delete('/:id', async (req, res) => {
    try {
        await ipcRequest(req, 'delete-preset', req.params.id);
        res.json({ message: 'Preset deleted successfully' });
    } catch (error) {
        console.error('Failed to delete preset via IPC:', error);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});

module.exports = router; 