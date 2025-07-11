const { ipcMain, BrowserWindow } = require('electron');
const Store = require('electron-store');
const authService = require('../../common/services/authService');
const userRepository = require('../../common/repositories/user');
const settingsRepository = require('./repositories');
const { getStoredApiKey, getStoredProvider, windowPool } = require('../../electron/windowManager');
const { DEFAULT_LANGUAGE, normalizeLanguageCode, isValidLanguageCode } = require('../../common/config/languages');

const store = new Store({
    name: 'pickle-glass-settings',
    defaults: {
        users: {}
    }
});

// Configuration constants
const NOTIFICATION_CONFIG = {
    RELEVANT_WINDOW_TYPES: ['settings', 'main'],
    DEBOUNCE_DELAY: 300, // prevent spam during bulk operations (ms)
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_BASE_DELAY: 1000, // exponential backoff base (ms)
};

// window targeting system
class WindowNotificationManager {
    constructor() {
        this.pendingNotifications = new Map();
    }

    /**
     * Send notifications only to relevant windows
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {object} options - Notification options
     */
    notifyRelevantWindows(event, data = null, options = {}) {
        const { 
            windowTypes = NOTIFICATION_CONFIG.RELEVANT_WINDOW_TYPES,
            debounce = NOTIFICATION_CONFIG.DEBOUNCE_DELAY 
        } = options;

        if (debounce > 0) {
            this.debounceNotification(event, () => {
                this.sendToTargetWindows(event, data, windowTypes);
            }, debounce);
        } else {
            this.sendToTargetWindows(event, data, windowTypes);
        }
    }

    sendToTargetWindows(event, data, windowTypes) {
        const relevantWindows = this.getRelevantWindows(windowTypes);
        
        if (relevantWindows.length === 0) {
            console.log(`[WindowNotificationManager] No relevant windows found for event: ${event}`);
            return;
        }

        console.log(`[WindowNotificationManager] Sending ${event} to ${relevantWindows.length} relevant windows`);
        
        relevantWindows.forEach(win => {
            try {
                if (data) {
                    win.webContents.send(event, data);
                } else {
                    win.webContents.send(event);
                }
            } catch (error) {
                console.warn(`[WindowNotificationManager] Failed to send ${event} to window:`, error.message);
            }
        });
    }

    getRelevantWindows(windowTypes) {
        const allWindows = BrowserWindow.getAllWindows();
        const relevantWindows = [];

        allWindows.forEach(win => {
            if (win.isDestroyed()) return;

            for (const [windowName, poolWindow] of windowPool || []) {
                if (poolWindow === win && windowTypes.includes(windowName)) {
                    if (windowName === 'settings' || win.isVisible()) {
                        relevantWindows.push(win);
                    }
                    break;
                }
            }
        });

        return relevantWindows;
    }

    debounceNotification(key, fn, delay) {
        // Clear existing timeout
        if (this.pendingNotifications.has(key)) {
            clearTimeout(this.pendingNotifications.get(key));
        }

        // Set new timeout
        const timeoutId = setTimeout(() => {
            fn();
            this.pendingNotifications.delete(key);
        }, delay);

        this.pendingNotifications.set(key, timeoutId);
    }

    cleanup() {
        // Clear all pending notifications
        this.pendingNotifications.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingNotifications.clear();
    }
}

// Global instance
const windowNotificationManager = new WindowNotificationManager();

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

function getDefaultSettings() {
    const isMac = process.platform === 'darwin';
    return {
        profile: 'school',
        language: 'DEFAULT_LANGUAGE',
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

async function getSettings() {
    try {
        const uid = authService.getCurrentUserId();
        const userSettingsKey = uid ? `users.${uid}` : 'users.default';
        
        const defaultSettings = getDefaultSettings();
        const savedSettings = store.get(userSettingsKey, {});
        
        currentSettings = { ...defaultSettings, ...savedSettings };
        return currentSettings;
    } catch (error) {
        console.error('[SettingsService] Error getting settings from store:', error);
        return getDefaultSettings();
    }
}

async function saveSettings(settings) {
    try {
        const uid = authService.getCurrentUserId();
        const userSettingsKey = uid ? `users.${uid}` : 'users.default';
        
        const currentSaved = store.get(userSettingsKey, {});
        const newSettings = { ...currentSaved, ...settings };
        
        // Validate and normalize language if provided
        if (settings.language) {
            const normalizedLanguage = normalizeLanguageCode(settings.language);
            if (!isValidLanguageCode(normalizedLanguage)) {
                console.warn(`[SettingsService] Invalid language code: ${settings.language}, using default`);
                newSettings.language = DEFAULT_LANGUAGE;
            } else {
                newSettings.language = normalizedLanguage;
            }
        }
        
        store.set(userSettingsKey, newSettings);
        currentSettings = newSettings;
        
        // Use smart notification system
        windowNotificationManager.notifyRelevantWindows('settings-updated', currentSettings);

        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error saving settings to store:', error);
        return { success: false, error: error.message };
    }
}

async function getPresets() {
    try {
        // The adapter now handles which presets to return based on login state.
        const presets = await settingsRepository.getPresets();
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
        // The adapter injects the UID.
        const result = await settingsRepository.createPreset({ title, prompt });
        
        windowNotificationManager.notifyRelevantWindows('presets-updated', {
            action: 'created',
            presetId: result.id,
            title
        });
        
        return { success: true, id: result.id };
    } catch (error) {
        console.error('[SettingsService] Error creating preset:', error);
        return { success: false, error: error.message };
    }
}

async function updatePreset(id, title, prompt) {
    try {
        // The adapter injects the UID.
        await settingsRepository.updatePreset(id, { title, prompt });
        
        windowNotificationManager.notifyRelevantWindows('presets-updated', {
            action: 'updated',
            presetId: id,
            title
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error updating preset:', error);
        return { success: false, error: error.message };
    }
}

async function deletePreset(id) {
    try {
        // The adapter injects the UID.
        await settingsRepository.deletePreset(id);
        
        windowNotificationManager.notifyRelevantWindows('presets-updated', {
            action: 'deleted',
            presetId: id
        });
        
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error deleting preset:', error);
        return { success: false, error: error.message };
    }
}

async function saveApiKey(apiKey, provider = 'openai') {
    try {
        const user = authService.getCurrentUser();
        if (!user.isLoggedIn) {
            // For non-logged-in users, save to local storage
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
        
        // For logged-in users, use the repository adapter which injects the UID.
        await userRepository.saveApiKey(apiKey, provider);
        
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
        const user = authService.getCurrentUser();
        if (!user.isLoggedIn) {
            // For non-logged-in users, remove from local storage
            const Store = require('electron-store');
            const store = new Store();
            store.delete('apiKey');
            store.delete('provider');
        } else {
            // For logged-in users, use the repository adapter.
            await userRepository.saveApiKey(null, null);
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

async function getAutoUpdateSetting() {
    try {
        return settingsRepository.getAutoUpdate();
    } catch (error) {
        console.error('[SettingsService] Error getting auto update setting:', error);
        return true; // Fallback to enabled
    }
}

async function setAutoUpdateSetting(isEnabled) {
    try {
        await settingsRepository.setAutoUpdate(isEnabled);
        return { success: true };
    } catch (error) {
        console.error('[SettingsService] Error setting auto update setting:', error);
        return { success: false, error: error.message };
    }
}

function initialize() {
    // cleanup 
    windowNotificationManager.cleanup();
    
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

    ipcMain.handle('settings:get-auto-update', async () => {
        return await getAutoUpdateSetting();
    });

    ipcMain.handle('settings:set-auto-update', async (event, isEnabled) => {
        console.log('[SettingsService] Setting auto update setting:', isEnabled);
        return await setAutoUpdateSetting(isEnabled);
    });
    
    // Language-specific handlers
    ipcMain.handle('settings:get-available-languages', async () => {
        const { getAvailableLanguages } = require('../../common/config/languages');
        return getAvailableLanguages();
    });

    ipcMain.handle('settings:get-popular-languages', async () => {
        const { getPopularLanguages } = require('../../common/config/languages');
        return getPopularLanguages();
    });

    ipcMain.handle('settings:get-current-language', async () => {
        const settings = await getSettings();
        return settings.language || DEFAULT_LANGUAGE;
    });

    ipcMain.handle('settings:set-language', async (event, languageCode) => {
        console.log('[SettingsService] Setting language:', languageCode);
        const result = await saveSettings({ language: languageCode });
        if (result.success) {
            // Notify all windows about language change
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('language-changed', languageCode);
                }
            });
        }
        return result;
    });
    
    console.log('[SettingsService] Initialized and ready.');
}

// Cleanup function
function cleanup() {
    windowNotificationManager.cleanup();
    console.log('[SettingsService] Cleaned up resources.');
}

function notifyPresetUpdate(action, presetId, title = null) {
    const data = { action, presetId };
    if (title) data.title = title;
    
    windowNotificationManager.notifyRelevantWindows('presets-updated', data);
}

module.exports = {
    initialize,
    cleanup,
    notifyPresetUpdate,
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
    getAutoUpdateSetting,
};