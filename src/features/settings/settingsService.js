const { ipcMain, BrowserWindow } = require('electron');
const authService = require('../../common/services/authService');
const userRepository = require('../../common/repositories/user');
const settingsRepository = require('./repositories');
const { getStoredApiKey, getStoredProvider, windowPool } = require('../../electron/windowManager');

// Default keybinds configuration
const DEFAULT_KEYBINDS = {
    mac: {
        moveUp: 'Cmd+Up',
        moveDown: 'Cmd+Down',
        moveLeft: 'Cmd+Left',
        moveRight: 'Cmd+Right',
        toggleVisibility: 'Cmd+\\',
        toggleClickThrough: 'Cmd+M',
        nextStep: 'Cmd+Enter',
        manualScreenshot: 'Cmd+Shift+S',
        previousResponse: 'Cmd+[',
        nextResponse: 'Cmd+]',
        scrollUp: 'Cmd+Shift+Up',
        scrollDown: 'Cmd+Shift+Down',
    },
    windows: {
        moveUp: 'Ctrl+Up',
        moveDown: 'Ctrl+Down',
        moveLeft: 'Ctrl+Left',
        moveRight: 'Ctrl+Right',
        toggleVisibility: 'Ctrl+\\',
        toggleClickThrough: 'Ctrl+M',
        nextStep: 'Ctrl+Enter',
        manualScreenshot: 'Ctrl+Shift+S',
        previousResponse: 'Ctrl+[',
        nextResponse: 'Ctrl+]',
        scrollUp: 'Ctrl+Shift+Up',
        scrollDown: 'Ctrl+Shift+Down',
    }
};

// Service state
let currentSettings = null;

async function getSettings() {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot get settings.");
        }
        
        const settings = await settingsRepository.getSettings(uid);
        currentSettings = settings;
        return settings;
    } catch (error) {
        console.error('[SettingsService] Error getting settings:', error);
        return null;
    }
}

function getDefaultSettings() {
    const isMac = process.platform === 'darwin';
    return {
        profile: 'school',
        language: 'en',
        screenshotInterval: '5000',
        imageQuality: '0.8',
        layoutMode: 'stacked',
        keybinds: isMac ? DEFAULT_KEYBINDS.mac : DEFAULT_KEYBINDS.windows,
        throttleTokens: 500,
        maxTokens: 2000,
        throttlePercent: 80,
        googleSearchEnabled: false,
        backgroundTransparency: 0.5,
        fontSize: 14,
        contentProtection: true
    };
}

async function saveSettings(settings) {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot save settings.");
        }
        
        await settingsRepository.saveSettings(uid, settings);
        currentSettings = settings;
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error saving settings:', error);
        return { success: false, error: error.message };
    }
}

async function getPresets() {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot get presets.");
        }
        
        const presets = await settingsRepository.getPresets(uid);
        return presets;
    } catch (error) {
        console.error('[SettingsService] Error getting presets:', error);
        return [];
    }
}

async function getPresetTemplates() {
    try {
        const templates = await settingsRepository.getPresetTemplates();
        return templates;
    } catch (error) {
        console.error('[SettingsService] Error getting preset templates:', error);
        return [];
    }
}

async function createPreset(title, prompt) {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot create preset.");
        }
        
        const result = await settingsRepository.createPreset({ uid, title, prompt });
        
        // 모든 윈도우에 프리셋 업데이트 알림
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('presets-updated');
            }
        });
        
        return { success: true, id: result.id };
    } catch (error) {
        console.error('[SettingsService] Error creating preset:', error);
        return { success: false, error: error.message };
    }
}

async function updatePreset(id, title, prompt) {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot update preset.");
        }
        
        await settingsRepository.updatePreset(id, { title, prompt }, uid);
        
        // 모든 윈도우에 프리셋 업데이트 알림
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('presets-updated');
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error updating preset:', error);
        return { success: false, error: error.message };
    }
}

async function deletePreset(id) {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            throw new Error("User not logged in, cannot delete preset.");
        }
        
        await settingsRepository.deletePreset(id, uid);
        
        // 모든 윈도우에 프리셋 업데이트 알림
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('presets-updated');
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error deleting preset:', error);
        return { success: false, error: error.message };
    }
}

async function saveApiKey(apiKey, provider = 'openai') {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            // For non-logged-in users, save to local storage
            const { app } = require('electron');
            const Store = require('electron-store');
            const store = new Store();
            store.set('apiKey', apiKey);
            store.set('provider', provider);
            
            // Notify windows
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('api-key-validated', apiKey);
                }
            });
            
            return { success: true };
        }
        
        // For logged-in users, save to database
        await userRepository.saveApiKey(apiKey, uid, provider);
        
        // Notify windows
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('api-key-validated', apiKey);
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error saving API key:', error);
        return { success: false, error: error.message };
    }
}

async function removeApiKey() {
    try {
        const uid = authService.getCurrentUserId();
        if (!uid) {
            // For non-logged-in users, remove from local storage
            const { app } = require('electron');
            const Store = require('electron-store');
            const store = new Store();
            store.delete('apiKey');
            store.delete('provider');
        } else {
            // For logged-in users, remove from database
            await userRepository.saveApiKey(null, uid, null);
        }
        
        // Notify windows
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('api-key-removed');
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error removing API key:', error);
        return { success: false, error: error.message };
    }
}

async function updateContentProtection(enabled) {
    try {
        const settings = await getSettings();
        settings.contentProtection = enabled;
        
        // Update content protection in main window
        const { app } = require('electron');
        const mainWindow = windowPool.get('main');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setContentProtection(enabled);
        }
        
        return await saveSettings(settings);
    } catch (error) {
        console.error('[SettingsService] Error updating content protection:', error);
        return { success: false, error: error.message };
    }
}

function initialize() {
    // IPC handlers for settings
    ipcMain.handle('settings:getSettings', async () => {
        return await getSettings();
    });
    
    ipcMain.handle('settings:saveSettings', async (event, settings) => {
        return await saveSettings(settings);
    });
    
    // IPC handlers for presets
    ipcMain.handle('settings:getPresets', async () => {
        return await getPresets();
    });
    
    ipcMain.handle('settings:getPresetTemplates', async () => {
        return await getPresetTemplates();
    });
    
    ipcMain.handle('settings:createPreset', async (event, title, prompt) => {
        return await createPreset(title, prompt);
    });
    
    ipcMain.handle('settings:updatePreset', async (event, id, title, prompt) => {
        return await updatePreset(id, title, prompt);
    });
    
    ipcMain.handle('settings:deletePreset', async (event, id) => {
        return await deletePreset(id);
    });
    
    ipcMain.handle('settings:saveApiKey', async (event, apiKey, provider) => {
        return await saveApiKey(apiKey, provider);
    });
    
    ipcMain.handle('settings:removeApiKey', async () => {
        return await removeApiKey();
    });
    
    ipcMain.handle('settings:updateContentProtection', async (event, enabled) => {
        return await updateContentProtection(enabled);
    });
    
    console.log('[SettingsService] Initialized and ready.');
}

module.exports = {
    initialize,
    getSettings,
    saveSettings,
    getPresets,
    getPresetTemplates,
    createPreset,
    updatePreset,
    deletePreset,
    saveApiKey,
    removeApiKey,
    updateContentProtection,
};