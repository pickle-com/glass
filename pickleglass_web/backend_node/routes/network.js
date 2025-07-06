const express = require('express');
const router = express.Router();

// Helper function to communicate with main process if available
async function sendToMainProcess(channel, ...args) {
    try {
        // Check if we're running in Electron context
        if (global.electronIpc) {
            return await global.electronIpc.invoke(channel, ...args);
        }
        
        // If not in Electron, return default values
        console.log('[Network API] Not in Electron context, returning defaults');
        return null;
    } catch (error) {
        console.error(`[Network API] Failed to communicate with main process:`, error);
        return null;
    }
}

// Get current network settings
router.get('/settings', async (req, res) => {
    try {
        console.log('[Network API] GET /settings called');
        
        // Try to get settings from main process
        const settings = await sendToMainProcess('get-network-settings');
        
        if (settings) {
            console.log('[Network API] Retrieved settings from main process:', settings);
            res.json(settings);
        } else {
            // Return default settings if not in Electron context
            const defaultSettings = {
                apiPort: null,
                webPort: null,
                lockPorts: false,
                currentApiPort: process.env.pickleglass_API_PORT ? parseInt(process.env.pickleglass_API_PORT) : null,
                currentWebPort: process.env.pickleglass_WEB_PORT ? parseInt(process.env.pickleglass_WEB_PORT) : null
            };
            console.log('[Network API] Returning default settings:', defaultSettings);
            res.json(defaultSettings);
        }
    } catch (error) {
        console.error('[Network API] Failed to get network settings:', error);
        res.status(500).json({ error: 'Failed to retrieve network settings' });
    }
});

// Save network settings
router.post('/settings', async (req, res) => {
    try {
        console.log('[Network API] POST /settings called with:', req.body);
        
        const result = await sendToMainProcess('save-network-settings', req.body);
        
        if (result) {
            console.log('[Network API] Settings saved successfully');
            res.json({ success: true, message: 'Network settings saved successfully' });
        } else {
            console.log('[Network API] Main process not available, settings not saved');
            res.status(503).json({ 
                error: 'Settings cannot be saved - main process not available',
                message: 'Network settings require the desktop application to be running'
            });
        }
    } catch (error) {
        console.error('[Network API] Failed to save network settings:', error);
        res.status(500).json({ error: 'Failed to save network settings' });
    }
});

// Lock current ports
router.post('/lock-ports', async (req, res) => {
    try {
        console.log('[Network API] POST /lock-ports called');
        
        const result = await sendToMainProcess('lock-current-ports');
        
        if (result) {
            console.log('[Network API] Ports locked successfully');
            res.json({ success: true, message: 'Current ports locked successfully' });
        } else {
            console.log('[Network API] Main process not available, ports not locked');
            res.status(503).json({ 
                error: 'Ports cannot be locked - main process not available',
                message: 'Port locking requires the desktop application to be running'
            });
        }
    } catch (error) {
        console.error('[Network API] Failed to lock current ports:', error);
        res.status(500).json({ error: 'Failed to lock current ports' });
    }
});

module.exports = router; 