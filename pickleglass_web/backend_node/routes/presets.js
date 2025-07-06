const express = require('express');
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

router.post('/', async (req, res) => {
    try {
        const result = await ipcRequest(req, 'create-preset', req.body);
        res.status(201).json({ ...result, message: 'Preset created successfully' });
    } catch (error) {
        console.error('Failed to create preset via IPC:', error);
        res.status(500).json({ error: 'Failed to create preset' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        await ipcRequest(req, 'update-preset', { id: req.params.id, data: req.body });
        res.json({ message: 'Preset updated successfully' });
    } catch (error) {
        console.error('Failed to update preset via IPC:', error);
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