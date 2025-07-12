const { BrowserWindow, globalShortcut, ipcMain, screen, app, shell, desktopCapturer } = require('electron');
const WindowLayoutManager = require('./windowLayoutManager');
const SmoothMovementManager = require('./smoothMovementManager');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

// Try to load sharp, but don't fail if it's not available
let sharp;
try {
    sharp = require('sharp');
    console.log('[WindowManager] Sharp module loaded successfully');
} catch (error) {
    console.warn('[WindowManager] Sharp module not available:', error.message);
    console.warn('[WindowManager] Screenshot functionality will work with reduced image processing capabilities');
    sharp = null;
}
const authService = require('../common/services/authService');
const systemSettingsRepository = require('../common/repositories/systemSettings');
const userRepository = require('../common/repositories/user');
const fetch = require('node-fetch');
const Store = require('electron-store');
const shortCutStore = new Store({
    name: 'user-preferences',
    defaults: {
        customKeybinds: {}
    }
});

/* ────────────────[ GLASS BYPASS ]─────────────── */
let liquidGlass;
const isLiquidGlassSupported = () => {
    if (process.platform !== 'darwin') {
        return false;
    }
    const majorVersion = parseInt(os.release().split('.')[0], 10);
    // return majorVersion >= 25; // macOS 26+ (Darwin 25+)
    return majorVersion >= 26; // See you soon!
};
let shouldUseLiquidGlass = isLiquidGlassSupported();
if (shouldUseLiquidGlass) {
    try {
        liquidGlass = require('electron-liquid-glass');
    } catch (e) {
        console.warn('Could not load optional dependency "electron-liquid-glass". The feature will be disabled.');
        shouldUseLiquidGlass = false;
    }
}
/* ────────────────[ GLASS BYPASS ]─────────────── */

let isContentProtectionOn = true;
let currentDisplayId = null;

let mouseEventsIgnored = false;
let lastVisibleWindows = new Set(['header']);
const HEADER_HEIGHT = 47;
const DEFAULT_WINDOW_WIDTH = 353;

let currentHeaderState = 'apikey';
const windowPool = new Map();
let fixedYPosition = 0;
let lastScreenshot = null;

let settingsHideTimer = null;

let selectedCaptureSourceId = null;

// let shortcutEditorWindow = null;
let layoutManager = null;
function updateLayout() {
    if (layoutManager) {
        layoutManager.updateLayout();
    }
}

let movementManager = null;


async function toggleFeature(featureName) {
    if (!windowPool.get(featureName) && currentHeaderState === 'main') {
        createFeatureWindows(windowPool.get('header'));
    }

    const header = windowPool.get('header');
    if (featureName === 'listen') {
        console.log(`[WindowManager] Toggling feature: ${featureName}`);
        const listenWindow = windowPool.get(featureName);
        const listenService = global.listenService;
        if (listenService && listenService.isSessionActive()) {
            console.log('[WindowManager] Listen session is active, closing it via toggle.');
            await listenService.closeSession();
            listenWindow.webContents.send('session-state-changed', { isActive: false });
            header.webContents.send('session-state-text', 'Done');
            // return;
        } else {
            if (listenWindow.isVisible()) {
                listenWindow.webContents.send('window-hide-animation');
                listenWindow.webContents.send('session-state-changed', { isActive: false });
                header.webContents.send('session-state-text', 'Listen');
            } else {
                listenWindow.show();
                updateLayout();
                listenWindow.webContents.send('window-show-animation');
                await listenService.initializeSession();
                listenWindow.webContents.send('session-state-changed', { isActive: true });
                header.webContents.send('session-state-text', 'Stop');
            }
        }
    }

    if (featureName === 'ask') {
        let askWindow = windowPool.get('ask');

        if (!askWindow || askWindow.isDestroyed()) {
            console.log('[WindowManager] Ask window not found, creating new one');
            return;
        }

        if (askWindow.isVisible()) {
            try {
                const hasResponse = await askWindow.webContents.executeJavaScript(`
                    (() => {
                        try {
                            // PickleGlassApp의 Shadow DOM 내부로 접근
                            const pickleApp = document.querySelector('pickle-glass-app');
                            if (!pickleApp || !pickleApp.shadowRoot) {
                                console.log('PickleGlassApp not found');
                                return false;
                            }
                            
                            // PickleGlassApp의 shadowRoot 내부에서 ask-view 찾기
                            const askView = pickleApp.shadowRoot.querySelector('ask-view');
                            if (!askView) {
                                console.log('AskView not found in PickleGlassApp shadow DOM');
                                return false;
                            }
                            
                            console.log('AskView found, checking state...');
                            console.log('currentResponse:', askView.currentResponse);
                            console.log('isLoading:', askView.isLoading);
                            console.log('isStreaming:', askView.isStreaming);
                            
                            const hasContent = !!(askView.currentResponse || askView.isLoading || askView.isStreaming);
                            
                            if (!hasContent && askView.shadowRoot) {
                                const responseContainer = askView.shadowRoot.querySelector('.response-container');
                                if (responseContainer && !responseContainer.classList.contains('hidden')) {
                                    const textContent = responseContainer.textContent.trim();
                                    const hasActualContent = textContent && 
                                        !textContent.includes('Ask a question to see the response here') &&
                                        textContent.length > 0;
                                    console.log('Response container content check:', hasActualContent);
                                    return hasActualContent;
                                }
                            }
                            
                            return hasContent;
                        } catch (error) {
                            console.error('Error checking AskView state:', error);
                            return false;
                        }
                    })()
                `);

                console.log(`[WindowManager] Ask window visible, hasResponse: ${hasResponse}`);

                if (hasResponse) {
                    askWindow.webContents.send('toggle-text-input');
                    console.log('[WindowManager] Sent toggle-text-input command');
                } else {
                    console.log('[WindowManager] No response found, closing window');
                    askWindow.webContents.send('window-hide-animation');
                }
            } catch (error) {
                console.error('[WindowManager] Error checking Ask window state:', error);
                console.log('[WindowManager] Falling back to toggle text input');
                askWindow.webContents.send('toggle-text-input');
            }
        } else {
            console.log('[WindowManager] Showing hidden Ask window');
            askWindow.show();
            updateLayout();
            askWindow.webContents.send('window-show-animation');
            askWindow.webContents.send('window-did-show');
        }
    }

    if (featureName === 'settings') {
        const settingsWindow = windowPool.get(featureName);

        if (settingsWindow) {
            if (settingsWindow.isDestroyed()) {
                console.error(`Window ${featureName} is destroyed, cannot toggle`);
                return;
            }

            if (settingsWindow.isVisible()) {
                if (featureName === 'settings') {
                    settingsWindow.webContents.send('settings-window-hide-animation');
                } else {
                    settingsWindow.webContents.send('window-hide-animation');
                }
            } else {
                try {
                    settingsWindow.show();
                    updateLayout();

                    settingsWindow.webContents.send('window-show-animation');
                } catch (e) {
                    console.error('Error showing window:', e);
                }
            }
        } else {
            console.error(`Window not found for feature: ${featureName}`);
            console.error('Available windows:', Array.from(windowPool.keys()));
        }
    }
}


function createFeatureWindows(header, namesToCreate) {
    // if (windowPool.has('listen')) return;

    const commonChildOptions = {
        parent: header,
        show: false,
        frame: false,
        transparent: true,
        vibrancy: false,
        hasShadow: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
    };

    const createFeatureWindow = (name) => {
        if (windowPool.has(name)) return;
        
        switch (name) {
            case 'listen': {
                const listen = new BrowserWindow({
                    ...commonChildOptions, width:400,minWidth:400,maxWidth:900,
                    maxHeight:900,
                });
                listen.setContentProtection(isContentProtectionOn);
                listen.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
                if (process.platform === 'darwin') {
                    listen.setWindowButtonVisibility(false);
                }
                const listenLoadOptions = { query: { view: 'listen' } };
                if (!shouldUseLiquidGlass) {
                    listen.loadFile(path.join(__dirname, '../app/content.html'), listenLoadOptions);
                }
                else {
                    listenLoadOptions.query.glass = 'true';
                    listen.loadFile(path.join(__dirname, '../app/content.html'), listenLoadOptions);
                    listen.webContents.once('did-finish-load', () => {
                        const viewId = liquidGlass.addView(listen.getNativeWindowHandle());
                        if (viewId !== -1) {
                            liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                            // liquidGlass.unstable_setScrim(viewId, 1);
                            // liquidGlass.unstable_setSubdued(viewId, 1);
                        }
                    });
                }
                if (!app.isPackaged) {
                    listen.webContents.openDevTools({ mode: 'detach' });
                }
                windowPool.set('listen', listen);
                break;
            }

            // ask
            case 'ask': {
                const ask = new BrowserWindow({ ...commonChildOptions, width:600 });
                ask.setContentProtection(isContentProtectionOn);
                ask.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
                if (process.platform === 'darwin') {
                    ask.setWindowButtonVisibility(false);
                }
                const askLoadOptions = { query: { view: 'ask' } };
                if (!shouldUseLiquidGlass) {
                    ask.loadFile(path.join(__dirname, '../app/content.html'), askLoadOptions);
                }
                else {
                    askLoadOptions.query.glass = 'true';
                    ask.loadFile(path.join(__dirname, '../app/content.html'), askLoadOptions);
                    ask.webContents.once('did-finish-load', () => {
                        const viewId = liquidGlass.addView(ask.getNativeWindowHandle());
                        if (viewId !== -1) {
                            liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                            // liquidGlass.unstable_setScrim(viewId, 1);
                            // liquidGlass.unstable_setSubdued(viewId, 1);
                        }
                    });
                }

                ask.on('blur',()=>ask.webContents.send('window-blur'));
                
                // Open DevTools in development
                if (!app.isPackaged) {
                    ask.webContents.openDevTools({ mode: 'detach' });
                }
                windowPool.set('ask', ask);
                break;
            }

            // settings
            case 'settings': {
                const settings = new BrowserWindow({ ...commonChildOptions, width:240, maxHeight:400, parent:undefined });
                settings.setContentProtection(isContentProtectionOn);
                settings.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
                if (process.platform === 'darwin') {
                    settings.setWindowButtonVisibility(false);
                }
                const settingsLoadOptions = { query: { view: 'settings' } };
                if (!shouldUseLiquidGlass) {
                    settings.loadFile(path.join(__dirname,'../app/content.html'), settingsLoadOptions)
                        .catch(console.error);
                }
                else {
                    settingsLoadOptions.query.glass = 'true';
                    settings.loadFile(path.join(__dirname,'../app/content.html'), settingsLoadOptions)
                        .catch(console.error);
                    settings.webContents.once('did-finish-load', () => {
                        const viewId = liquidGlass.addView(settings.getNativeWindowHandle());
                        if (viewId !== -1) {
                            liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                            // liquidGlass.unstable_setScrim(viewId, 1);
                            // liquidGlass.unstable_setSubdued(viewId, 1);
                        }
                    });
                }
                windowPool.set('settings', settings);  
                break;
            }

            case 'shortcut-settings': {
                const shortcutEditor = new BrowserWindow({
                    ...commonChildOptions,
                    width: 420,
                    height: 720,
                    modal: false,
                    parent: undefined,
                    alwaysOnTop: true,
                    titleBarOverlay: false,
                });

                if (process.platform === 'darwin') {
                    shortcutEditor.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    shortcutEditor.setAlwaysOnTop(true);
                }
            
                /* ──────────[ ① 다른 창 클릭 차단 ]────────── */
                const disableClicks = () => {
                    for (const [name, win] of windowPool) {
                        if (win !== shortcutEditor && !win.isDestroyed()) {
                            win.setIgnoreMouseEvents(true, { forward: true });
                        }
                    }
                };
                const restoreClicks = () => {
                    for (const [, win] of windowPool) {
                        if (!win.isDestroyed()) win.setIgnoreMouseEvents(false);
                    }
                };

                const header = windowPool.get('header');
                if (header && !header.isDestroyed()) {
                    const { x, y, width } = header.getBounds();
                    shortcutEditor.setBounds({ x, y, width });
                }

                shortcutEditor.once('ready-to-show', () => {
                    disableClicks(); 
                    shortcutEditor.show();
                });

                const loadOptions = { query: { view: 'shortcut-settings' } };
                if (!shouldUseLiquidGlass) {
                    shortcutEditor.loadFile(path.join(__dirname, '../app/content.html'), loadOptions);
                } else {
                    loadOptions.query.glass = 'true';
                    shortcutEditor.loadFile(path.join(__dirname, '../app/content.html'), loadOptions);
                    shortcutEditor.webContents.once('did-finish-load', () => {
                        const viewId = liquidGlass.addView(shortcutEditor.getNativeWindowHandle());
                        if (viewId !== -1) {
                            liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                        }
                    });
                }
                
                shortcutEditor.on('closed', () => {
                    restoreClicks();
                    windowPool.delete('shortcut-settings');
                    console.log('[Shortcuts] Re-enabled after editing.');
                    loadAndRegisterShortcuts(movementManager);
                });

                shortcutEditor.webContents.once('dom-ready', async () => {
                    const savedKeybinds = shortCutStore.get('customKeybinds', {});
                    const defaultKeybinds = getDefaultKeybinds();
                    const keybinds = { ...defaultKeybinds, ...savedKeybinds };
                    shortcutEditor.webContents.send('load-shortcuts', keybinds);
                });

                if (!app.isPackaged) {
                    shortcutEditor.webContents.openDevTools({ mode: 'detach' });
                }
                windowPool.set('shortcut-settings', shortcutEditor);
                break;
            }
        }
    };

    if (Array.isArray(namesToCreate)) {
        namesToCreate.forEach(name => createFeatureWindow(name));
    } else if (typeof namesToCreate === 'string') {
        createFeatureWindow(namesToCreate);
    } else {
        createFeatureWindow('listen');
        createFeatureWindow('ask');
        createFeatureWindow('settings');
    }
}

function destroyFeatureWindows() {
    const featureWindows = ['listen','ask','settings','shortcut-settings'];
    if (settingsHideTimer) {
        clearTimeout(settingsHideTimer);
        settingsHideTimer = null;
    }
    featureWindows.forEach(name=>{
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.destroy();
        windowPool.delete(name);
    });
}



function getCurrentDisplay(window) {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();

    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };

    return screen.getDisplayNearestPoint(windowCenter);
}

function getDisplayById(displayId) {
    const displays = screen.getAllDisplays();
    return displays.find(d => d.id === displayId) || screen.getPrimaryDisplay();
}



function toggleAllWindowsVisibility() {
    const header = windowPool.get('header');
    if (!header) return;
  
    if (header.isVisible()) {
      lastVisibleWindows.clear();
  
      windowPool.forEach((win, name) => {
        if (win && !win.isDestroyed() && win.isVisible()) {
          lastVisibleWindows.add(name);
        }
      });
  
      lastVisibleWindows.forEach(name => {
        if (name === 'header') return;
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.hide();
      });
      header.hide();
  
      return;
    }
  
    lastVisibleWindows.forEach(name => {
      const win = windowPool.get(name);
      if (win && !win.isDestroyed())
        win.show();
    });
  }


function createWindows() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { y: workAreaY, width: screenWidth } = primaryDisplay.workArea;

    const initialX = Math.round((screenWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const initialY = workAreaY + 21;
    movementManager = new SmoothMovementManager(windowPool, getDisplayById, getCurrentDisplay, updateLayout);
    
    const header = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: HEADER_HEIGHT,
        x: initialX,
        y: initialY,
        frame: false,
        transparent: true,
        vibrancy: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        focusable: true,
        acceptFirstMouse: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: false,
            enableRemoteModule: false,
            // Ensure proper rendering and prevent pixelation
            experimentalFeatures: false,
        },
        // Prevent pixelation and ensure proper rendering
        useContentSize: true,
        disableAutoHideCursor: true,
    });
    if (process.platform === 'darwin') {
        header.setWindowButtonVisibility(false);
    }
    const headerLoadOptions = {};
    if (!shouldUseLiquidGlass) {
        header.loadFile(path.join(__dirname, '../app/header.html'), headerLoadOptions);
    }
    else {
        headerLoadOptions.query = { glass: 'true' };
        header.loadFile(path.join(__dirname, '../app/header.html'), headerLoadOptions);
        header.webContents.once('did-finish-load', () => {
            const viewId = liquidGlass.addView(header.getNativeWindowHandle());
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                // liquidGlass.unstable_setScrim(viewId, 1); 
                // liquidGlass.unstable_setSubdued(viewId, 1);
            }
        });
    }
    windowPool.set('header', header);
    header.on('moved', updateLayout);
    layoutManager = new WindowLayoutManager(windowPool);

    header.webContents.once('dom-ready', () => {
        loadAndRegisterShortcuts(movementManager);
    });

    setupIpcHandlers(movementManager);

    if (currentHeaderState === 'main') {
        createFeatureWindows(header, ['listen', 'ask', 'settings', 'shortcut-settings']);
    }

    header.setContentProtection(isContentProtectionOn);
    header.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // header.loadFile(path.join(__dirname, '../app/header.html'));
    
    // Open DevTools in development
    if (!app.isPackaged) {
        header.webContents.openDevTools({ mode: 'detach' });
    }

    header.on('focus', () => {
        console.log('[WindowManager] Header gained focus');
    });

    header.on('blur', () => {
        console.log('[WindowManager] Header lost focus');
    });

    header.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'mouseDown') {
            const target = input.target;
            if (target && (target.includes('input') || target.includes('apikey'))) {
                header.focus();
            }
        }
    });

    header.on('resize', () => {
        console.log('[WindowManager] Header resize event triggered');
        updateLayout();
    });

    ipcMain.handle('toggle-all-windows-visibility', () => toggleAllWindowsVisibility());

    ipcMain.handle('toggle-feature', async (event, featureName) => {
        return toggleFeature(featureName);
    });

    ipcMain.handle('send-question-to-ask', (event, question) => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            console.log('📨 Main process: Sending question to AskView', question);
            askWindow.webContents.send('receive-question-from-assistant', question);
            return { success: true };
        } else {
            console.error('❌ Cannot find AskView window');
            return { success: false, error: 'AskView window not found' };
        }
    });

    ipcMain.handle('adjust-window-height', (event, targetHeight) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (senderWindow) {
            const wasResizable = senderWindow.isResizable();
            if (!wasResizable) {
                senderWindow.setResizable(true);
            }

            const currentBounds = senderWindow.getBounds();
            const minHeight = senderWindow.getMinimumSize()[1];
            const maxHeight = senderWindow.getMaximumSize()[1];
            
            let adjustedHeight;
            if (maxHeight === 0) {
                adjustedHeight = Math.max(minHeight, targetHeight);
            } else {
                adjustedHeight = Math.max(minHeight, Math.min(maxHeight, targetHeight));
            }
            
            senderWindow.setSize(currentBounds.width, adjustedHeight, false);

            if (!wasResizable) {
                senderWindow.setResizable(false);
            }

            updateLayout();
        }
    });

    ipcMain.on('session-did-close', () => {
        const listenWindow = windowPool.get('listen');
        if (listenWindow && listenWindow.isVisible()) {
            console.log('[WindowManager] Session closed, hiding listen window.');
            listenWindow.hide();
        }
    });

    return windowPool;
}

function loadAndRegisterShortcuts(movementManager) {
    if (windowPool.has('shortcut-settings')) {
        console.log('[Shortcuts] Editing in progress, skipping registration.');
        return;
    }

    const defaultKeybinds = getDefaultKeybinds();
    const savedKeybinds = shortCutStore.get('customKeybinds', {});
    const keybinds = { ...defaultKeybinds, ...savedKeybinds };

    const sendToRenderer = (channel, ...args) => {
        windowPool.forEach(win => {
            if (win && !win.isDestroyed()) {
                try {
                    win.webContents.send(channel, ...args);
                } catch (e) {
                    // 창이 이미 닫혔을 수 있으므로 오류를 무시합니다.
                }
            }
        });
    };

    updateGlobalShortcuts(keybinds, windowPool.get('header'), sendToRenderer, movementManager);
}


function setupIpcHandlers(movementManager) {
    screen.on('display-added', (event, newDisplay) => {
        console.log('[Display] New display added:', newDisplay.id);
    });

    screen.on('display-removed', (event, oldDisplay) => {
        console.log('[Display] Display removed:', oldDisplay.id);
        const header = windowPool.get('header');
        if (header && getCurrentDisplay(header).id === oldDisplay.id) {
            const primaryDisplay = screen.getPrimaryDisplay();
            movementManager.moveToDisplay(primaryDisplay.id);
        }
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
        console.log('[Display] Display metrics changed:', display.id, changedMetrics);
        updateLayout();
    });

    // 1. 스트리밍 데이터 조각(chunk)을 받아서 ask 창으로 전달
    ipcMain.on('ask-response-chunk', (event, { token }) => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            // renderer.js가 보낸 토큰을 AskView.js로 그대로 전달합니다.
            askWindow.webContents.send('ask-response-chunk', { token });
        }
    });

    // 2. 스트리밍 종료 신호를 받아서 ask 창으로 전달
    ipcMain.on('ask-response-stream-end', () => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            askWindow.webContents.send('ask-response-stream-end');
        }
    });

    ipcMain.on('animation-finished', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            console.log(`[WindowManager] Hiding window after animation.`);
            win.hide();
        }
    });

    ipcMain.on('show-settings-window', (event, bounds) => {
        if (!bounds) return;  
        const win = windowPool.get('settings');

        if (win && !win.isDestroyed()) {
            if (settingsHideTimer) {
                clearTimeout(settingsHideTimer);
                settingsHideTimer = null;
            }

            // Adjust position based on button bounds
            const header = windowPool.get('header');
            const headerBounds = header?.getBounds() ?? { x: 0, y: 0 };
            const settingsBounds = win.getBounds();

            const disp = getCurrentDisplay(header);
            const { x: waX, y: waY, width: waW, height: waH } = disp.workArea;

            let x = Math.round(headerBounds.x + (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2 - settingsBounds.width / 2);
            let y = Math.round(headerBounds.y + (bounds?.y ?? 0) + (bounds?.height ?? 0) + 31);

            x = Math.max(waX + 10, Math.min(waX + waW - settingsBounds.width - 10, x));
            y = Math.max(waY + 10, Math.min(waY + waH - settingsBounds.height - 10, y));

            win.setBounds({ x, y });
            win.__lockedByButton = true;
            console.log(`[WindowManager] Positioning settings window at (${x}, ${y}) based on button bounds.`);
            
            win.show();
            win.moveTop();
            win.setAlwaysOnTop(true);
        }
    });

    ipcMain.on('hide-settings-window', (event) => {
        const window = windowPool.get("settings");
        if (window && !window.isDestroyed()) {
            if (settingsHideTimer) {
                clearTimeout(settingsHideTimer);
            }
            settingsHideTimer = setTimeout(() => {
                if (window && !window.isDestroyed()) {
                    window.setAlwaysOnTop(false);
                    window.hide();
                }
                settingsHideTimer = null;
            }, 200);
            
            window.__lockedByButton = false;
        }
    });

    ipcMain.on('cancel-hide-settings-window', (event) => {
        if (settingsHideTimer) {
            clearTimeout(settingsHideTimer);
            settingsHideTimer = null;
        }
    });

    ipcMain.handle('quit-application', () => {
        app.quit();
    });

    ipcMain.handle('is-ask-window-visible', (event, windowName) => {
        const window = windowPool.get(windowName);
        if (window && !window.isDestroyed()) {
            return window.isVisible();
        }
        return false;
    });


    ipcMain.handle('toggle-content-protection', () => {
        isContentProtectionOn = !isContentProtectionOn;
        console.log(`[Protection] Content protection toggled to: ${isContentProtectionOn}`);
        windowPool.forEach(win => {
            if (win && !win.isDestroyed()) {
                win.setContentProtection(isContentProtectionOn);
            }
        });
        return isContentProtectionOn;
    });

    ipcMain.handle('get-content-protection-status', () => {
        return isContentProtectionOn;
    });

    ipcMain.on('header-state-changed', (event, state) => {
        console.log(`[WindowManager] Header state changed to: ${state}`);
        currentHeaderState = state;

        if (state === 'main') {
            createFeatureWindows(windowPool.get('header'));
        } else {         // 'apikey' | 'permission'
            destroyFeatureWindows();
        }
        loadAndRegisterShortcuts(movementManager);
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        updateGlobalShortcuts(newKeybinds);
    });

    ipcMain.handle('get-current-shortcuts', () => {
        const defaultKeybinds = getDefaultKeybinds();
        const savedKeybinds = shortCutStore.get('customKeybinds', {});
        return { ...defaultKeybinds, ...savedKeybinds };
    });

    ipcMain.handle('open-shortcut-editor', () => {
        const header = windowPool.get('header');
        if (!header) return;
        
        // 편집기 열기 전 모든 단축키 비활성화
        globalShortcut.unregisterAll();
        console.log('[Shortcuts] Disabled for editing.');

        createFeatureWindows(header, 'shortcut-settings');
    });

    ipcMain.handle('get-default-shortcuts', () => {
        shortCutStore.set('customKeybinds', {});
        return getDefaultKeybinds();
    });

    ipcMain.handle('save-shortcuts', async (event, newKeybinds) => {
        try {
            const defaultKeybinds = getDefaultKeybinds();
            const customKeybinds = {};
            for (const key in newKeybinds) {
                if (newKeybinds[key] && newKeybinds[key] !== defaultKeybinds[key]) {
                    customKeybinds[key] = newKeybinds[key];
                }
            }
            
            shortCutStore.set('customKeybinds', customKeybinds);
            console.log('[Shortcuts] Custom keybinds saved to store:', customKeybinds);

            const editor = windowPool.get('shortcut-settings');
            if (editor && !editor.isDestroyed()) {
                editor.close(); 
            } else {
                loadAndRegisterShortcuts(movementManager);
            }

            return { success: true };
        } catch (error) {
            console.error("Failed to save shortcuts:", error);
            loadAndRegisterShortcuts(movementManager);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('close-shortcut-editor', () => {
        const editor = windowPool.get('shortcut-settings');
        if (editor && !editor.isDestroyed()) {
            editor.close();
        }
    });

    ipcMain.handle('open-login-page', () => {
        const webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
        const personalizeUrl = `${webUrl}/personalize?desktop=true`;
        shell.openExternal(personalizeUrl);
        console.log('Opening personalization page:', personalizeUrl);
    });

    setupApiKeyIPC();


    ipcMain.handle('resize-header-window', (event, { width, height }) => {
        const header = windowPool.get('header');
        if (header) {
            console.log(`[WindowManager] Resize request: ${width}x${height}`);
            
            // Prevent resizing during animations or if already at target size
            if (movementManager && movementManager.isAnimating) {
                console.log('[WindowManager] Skipping resize during animation');
                return { success: false, error: 'Cannot resize during animation' };
            }

            const currentBounds = header.getBounds();
            console.log(`[WindowManager] Current bounds: ${currentBounds.width}x${currentBounds.height} at (${currentBounds.x}, ${currentBounds.y})`);
            
            // Skip if already at target size to prevent unnecessary operations
            if (currentBounds.width === width && currentBounds.height === height) {
                console.log('[WindowManager] Already at target size, skipping resize');
                return { success: true };
            }

            const wasResizable = header.isResizable();
            if (!wasResizable) {
                header.setResizable(true);
            }

            // Calculate the center point of the current window
            const centerX = currentBounds.x + currentBounds.width / 2;
            // Calculate new X position to keep the window centered
            const newX = Math.round(centerX - width / 2);

            // Get the current display to ensure we stay within bounds
            const display = getCurrentDisplay(header);
            const { x: workAreaX, width: workAreaWidth } = display.workArea;
            
            // Clamp the new position to stay within display bounds
            const clampedX = Math.max(workAreaX, Math.min(workAreaX + workAreaWidth - width, newX));

            header.setBounds({ x: clampedX, y: currentBounds.y, width, height });

            if (!wasResizable) {
                header.setResizable(false);
            }
            
            // Update layout after resize
            updateLayout();
            
            return { success: true };
        }
        return { success: false, error: 'Header window not found' };
    });

    ipcMain.on('header-animation-finished', (event, state) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;
    
        if (state === 'hidden') {
            header.hide();
            console.log('[WindowManager] Header hidden after animation.');
        } else if (state === 'visible') {
            console.log('[WindowManager] Header shown after animation.');
            updateLayout();
        }
    });

    ipcMain.handle('get-header-position', () => {
        const header = windowPool.get('header');
        if (header) {
            const [x, y] = header.getPosition();
            return { x, y };
        }
        return { x: 0, y: 0 };
    });

    ipcMain.handle('move-header', (event, newX, newY) => {
        const header = windowPool.get('header');
        if (header) {
            const currentY = newY !== undefined ? newY : header.getBounds().y;
            header.setPosition(newX, currentY, false);

            updateLayout();
        }
    });

    ipcMain.handle('move-header-to', (event, newX, newY) => {
        const header = windowPool.get('header');
        if (header) {
            const targetDisplay = screen.getDisplayNearestPoint({ x: newX, y: newY });
            const { x: workAreaX, y: workAreaY, width, height } = targetDisplay.workArea;
            const headerBounds = header.getBounds();

            // Only clamp if the new position would actually go out of bounds
            // This prevents progressive restriction of movement
            let clampedX = newX;
            let clampedY = newY;
            
            // Check if we need to clamp X position
            if (newX < workAreaX) {
                clampedX = workAreaX;
            } else if (newX + headerBounds.width > workAreaX + width) {
                clampedX = workAreaX + width - headerBounds.width;
            }
            
            // Check if we need to clamp Y position  
            if (newY < workAreaY) {
                clampedY = workAreaY;
            } else if (newY + headerBounds.height > workAreaY + height) {
                clampedY = workAreaY + height - headerBounds.height;
            }

            header.setPosition(clampedX, clampedY, false);

            updateLayout();
        }
    });


    ipcMain.handle('move-window-step', (event, direction) => {
        if (movementManager) {
            movementManager.moveStep(direction);
        }
    });

    ipcMain.handle('force-close-window', (event, windowName) => {
        const window = windowPool.get(windowName);
        if (window && !window.isDestroyed()) {
            console.log(`[WindowManager] Force closing window: ${windowName}`);

            window.webContents.send('window-hide-animation');
        }
    });

    ipcMain.handle('start-screen-capture', async () => {
        try {
            isCapturing = true;
            console.log('Starting screen capture in main process');
            return { success: true };
        } catch (error) {
            console.error('Failed to start screen capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-screen-capture', async () => {
        try {
            isCapturing = false;
            lastScreenshot = null;
            console.log('Stopped screen capture in main process');
            return { success: true };
        } catch (error) {
            console.error('Failed to stop screen capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('capture-screenshot', async (event, options = {}) => {
        return captureScreenshot(options);
    });

    ipcMain.handle('get-current-screenshot', async event => {
        try {
            if (lastScreenshot && Date.now() - lastScreenshot.timestamp < 1000) {
                console.log('Returning cached screenshot');
                return {
                    success: true,
                    base64: lastScreenshot.base64,
                    width: lastScreenshot.width,
                    height: lastScreenshot.height,
                };
            }
            return {
                success: false,
                error: 'No screenshot available',
            };
        } catch (error) {
            console.error('Failed to get current screenshot:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle('firebase-logout', async () => {
        console.log('[WindowManager] Received request to log out.');
        
        await authService.signOut();
    });

    ipcMain.handle('check-system-permissions', async () => {
        const { systemPreferences } = require('electron');
        const permissions = {
            microphone: 'unknown',
            screen: 'unknown',
            needsSetup: true
        };

        try {
            if (process.platform === 'darwin') {
                // Check microphone permission on macOS
                const micStatus = systemPreferences.getMediaAccessStatus('microphone');
                console.log('[Permissions] Microphone status:', micStatus);
                permissions.microphone = micStatus;

                // Check screen recording permission using the system API
                const screenStatus = systemPreferences.getMediaAccessStatus('screen');
                console.log('[Permissions] Screen status:', screenStatus);
                permissions.screen = screenStatus;

                permissions.needsSetup = micStatus !== 'granted' || screenStatus !== 'granted';
            } else {
                permissions.microphone = 'granted';
                permissions.screen = 'granted';
                permissions.needsSetup = false;
            }

            console.log('[Permissions] System permissions status:', permissions);
            return permissions;
        } catch (error) {
            console.error('[Permissions] Error checking permissions:', error);
            return {
                microphone: 'unknown',
                screen: 'unknown',
                needsSetup: true,
                error: error.message
            };
        }
    });

    ipcMain.handle('request-microphone-permission', async () => {
        if (process.platform !== 'darwin') {
            return { success: true };
        }

        const { systemPreferences } = require('electron');
        try {
            const status = systemPreferences.getMediaAccessStatus('microphone');
            console.log('[Permissions] Microphone status:', status);
            if (status === 'granted') {
                return { success: true, status: 'granted' };
            }

            // Req mic permission
            const granted = await systemPreferences.askForMediaAccess('microphone');
            return { 
                success: granted, 
                status: granted ? 'granted' : 'denied'
            };
        } catch (error) {
            console.error('[Permissions] Error requesting microphone permission:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    });

    ipcMain.handle('open-system-preferences', async (event, section) => {
        if (process.platform !== 'darwin') {
            return { success: false, error: 'Not supported on this platform' };
        }

        try {
            if (section === 'screen-recording') {
                // First trigger screen capture request to register the app in system preferences
                try {
                    console.log('[Permissions] Triggering screen capture request to register app...');
                    await desktopCapturer.getSources({ 
                        types: ['screen'], 
                        thumbnailSize: { width: 1, height: 1 } 
                    });
                    console.log('[Permissions] App registered for screen recording');
                } catch (captureError) {
                    console.log('[Permissions] Screen capture request triggered (expected to fail):', captureError.message);
                }
                
                // Then open system preferences
                // await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            }
            // if (section === 'microphone') {
            //     await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            // }
            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error opening system preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('mark-permissions-completed', async () => {
        try {
            // This is a system-level setting, not user-specific.
            await systemSettingsRepository.markPermissionsAsCompleted();
            console.log('[Permissions] Marked permissions as completed');
            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error marking permissions as completed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('check-permissions-completed', async () => {
        try {
            const completed = await systemSettingsRepository.checkPermissionsCompleted();
            console.log('[Permissions] Permissions completed status:', completed);
            return completed;
        } catch (error) {
            console.error('[Permissions] Error checking permissions completed status:', error);
            return false;
        }
    });

    ipcMain.handle('close-ask-window-if-empty', async () => {
        const askWindow = windowPool.get('ask');
        if (askWindow && !askWindow.isFocused()) {
            askWindow.hide();
        }
    });
}



//////// after_modelStateService ////////
async function getStoredApiKey() {
    if (global.modelStateService) {
        const provider = await getStoredProvider();
        return global.modelStateService.getApiKey(provider);
    }
    return null; // Fallback
}

async function getStoredProvider() {
    if (global.modelStateService) {
        return global.modelStateService.getCurrentProvider('llm');
    }
    return 'openai'; // Fallback
}

/**
 * 
 * @param {IpcMainInvokeEvent} event 
 * @param {{type: 'llm' | 'stt'}}
 */
async function getCurrentModelInfo(event, { type }) {
    if (global.modelStateService && (type === 'llm' || type === 'stt')) {
        return global.modelStateService.getCurrentModelInfo(type);
    }
    return null;
}

function setupApiKeyIPC() {
    const { ipcMain } = require('electron');

    ipcMain.handle('get-stored-api-key', getStoredApiKey);
    ipcMain.handle('get-ai-provider', getStoredProvider);
    ipcMain.handle('get-current-model-info', getCurrentModelInfo);

    ipcMain.handle('api-key-validated', async (event, data) => {
        console.warn("[DEPRECATED] 'api-key-validated' IPC was called. This logic is now handled by 'model:validate-key'.");
        return { success: true };
    });

    ipcMain.handle('remove-api-key', async () => {
         console.warn("[DEPRECATED] 'remove-api-key' IPC was called. This is now handled by 'model:remove-api-key'.");
        return { success: true };
    });
    
    console.log('[WindowManager] API key related IPC handlers have been updated for ModelStateService.');
}
//////// after_modelStateService ////////


function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Cmd+Up' : 'Ctrl+Up',
        moveDown: isMac ? 'Cmd+Down' : 'Ctrl+Down',
        moveLeft: isMac ? 'Cmd+Left' : 'Ctrl+Left',
        moveRight: isMac ? 'Cmd+Right' : 'Ctrl+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        manualScreenshot: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, movementManager) {
    globalShortcut.unregisterAll();

    if (sendToRenderer) {
        sendToRenderer('shortcuts-updated', keybinds);
        console.log('[Shortcuts] Broadcasted updated shortcuts to all windows.');
    }
    
    // ✨ 하드코딩된 단축키 등록을 위해 변수 유지
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Cmd' : 'Ctrl';
    const header = windowPool.get('header');
    const state = header?.currentHeaderState || currentHeaderState;

    // ✨ 기능 1: 사용자가 설정할 수 없는 '모니터 이동' 단축키 (기존 로직 유지)
    const displays = screen.getAllDisplays();
    if (displays.length > 1) {
        displays.forEach((display, index) => {
            const key = `${modifier}+Shift+${index + 1}`;
            try {
                globalShortcut.register(key, () => movementManager.moveToDisplay(display.id));
                console.log(`Registered display switch shortcut: ${key} -> Display ${index + 1}`);
            } catch (error) {
                console.error(`Failed to register display switch ${key}:`, error);
            }
        });
    }

    // API 키 입력 상태에서는 필수 단축키(toggleVisibility) 외에는 아무것도 등록하지 않음
    if (state === 'apikey') {
        if (keybinds.toggleVisibility) {
            try {
                globalShortcut.register(keybinds.toggleVisibility, () => toggleAllWindowsVisibility());
            } catch (error) {
                console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
            }
        }
        console.log('ApiKeyHeader is active, skipping conditional shortcuts');
        return;
    }

    // ✨ 기능 2: 사용자가 설정할 수 없는 '화면 가장자리 이동' 단축키 (기존 로직 유지)
    const edgeDirections = [
        { key: `${modifier}+Shift+Left`, direction: 'left' },
        { key: `${modifier}+Shift+Right`, direction: 'right' },
        // { key: `${modifier}+Shift+Up`, direction: 'up' },
        // { key: `${modifier}+Shift+Down`, direction: 'down' },
    ];
    edgeDirections.forEach(({ key, direction }) => {
        try {
            globalShortcut.register(key, () => {
                if (header && header.isVisible()) movementManager.moveToEdge(direction);
            });
        } catch (error) {
            console.error(`Failed to register edge move for ${key}:`, error);
        }
    });


    // ✨ 기능 3: 사용자가 설정 가능한 모든 단축키를 동적으로 등록 (새로운 방식 적용)
    for (const action in keybinds) {
        const accelerator = keybinds[action];
        if (!accelerator) continue;

        try {
            let callback;
            switch(action) {
                case 'toggleVisibility':
                    callback = () => toggleAllWindowsVisibility();
                    break;
                case 'nextStep':
                    callback = () => toggleFeature('ask');
                    break;
                case 'scrollUp':
                    callback = () => {
                        // 'ask' 창을 명시적으로 가져옵니다.
                        const askWindow = windowPool.get('ask');
                        // 'ask' 창이 존재하고, 파괴되지 않았으며, 보이는 경우에만 이벤트를 전송합니다.
                        if (askWindow && !askWindow.isDestroyed() && askWindow.isVisible()) {
                            askWindow.webContents.send('scroll-response-up');
                        }
                    };
                    break;
                case 'scrollDown':
                    callback = () => {
                        // 'ask' 창을 명시적으로 가져옵니다.
                        const askWindow = windowPool.get('ask');
                        // 'ask' 창이 존재하고, 파괴되지 않았으며, 보이는 경우에만 이벤트를 전송합니다.
                        if (askWindow && !askWindow.isDestroyed() && askWindow.isVisible()) {
                            askWindow.webContents.send('scroll-response-down');
                        }
                    };
                    break;
                case 'moveUp':
                    callback = () => { if (header && header.isVisible()) movementManager.moveStep('up'); };
                    break;
                case 'moveDown':
                    callback = () => { if (header && header.isVisible()) movementManager.moveStep('down'); };
                    break;
                case 'moveLeft':
                    callback = () => { if (header && header.isVisible()) movementManager.moveStep('left'); };
                    break;
                case 'moveRight':
                    callback = () => { if (header && header.isVisible()) movementManager.moveStep('right'); };
                    break;
                case 'toggleClickThrough':
                     callback = () => {
                        mouseEventsIgnored = !mouseEventsIgnored;
                        if(mainWindow && !mainWindow.isDestroyed()){
                            mainWindow.setIgnoreMouseEvents(mouseEventsIgnored, { forward: true });
                            mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
                        }
                     };
                     break;
                case 'manualScreenshot':
                    callback = () => {
                        if(mainWindow && !mainWindow.isDestroyed()) {
                             mainWindow.webContents.executeJavaScript('window.captureManualScreenshot && window.captureManualScreenshot();');
                        }
                    };
                    break;
                case 'previousResponse':
                    callback = () => sendToRenderer('navigate-previous-response');
                    break;
                case 'nextResponse':
                    callback = () => sendToRenderer('navigate-next-response');
                    break;
            }
            
            if (callback) {
                globalShortcut.register(accelerator, callback);
            }
        } catch(e) {
            console.error(`Failed to register shortcut for "${action}" (${accelerator}):`, e.message);
        }
    }
}


async function captureScreenshot(options = {}) {
    if (process.platform === 'darwin') {
        try {
            const tempPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.jpg`);

            await execFile('screencapture', ['-x', '-t', 'jpg', tempPath]);

            const imageBuffer = await fs.promises.readFile(tempPath);
            await fs.promises.unlink(tempPath);

            if (sharp) {
                try {
                    // Try using sharp for optimal image processing
                    const resizedBuffer = await sharp(imageBuffer)
                        // .resize({ height: 1080 })
                        .resize({ height: 384 })
                        .jpeg({ quality: 80 })
                        .toBuffer();

                    const base64 = resizedBuffer.toString('base64');
                    const metadata = await sharp(resizedBuffer).metadata();

                    lastScreenshot = {
                        base64,
                        width: metadata.width,
                        height: metadata.height,
                        timestamp: Date.now(),
                    };

                    return { success: true, base64, width: metadata.width, height: metadata.height };
                } catch (sharpError) {
                    console.warn('Sharp module failed, falling back to basic image processing:', sharpError.message);
                }
            }
            
            // Fallback: Return the original image without resizing
            console.log('[WindowManager] Using fallback image processing (no resize/compression)');
            const base64 = imageBuffer.toString('base64');
            
            lastScreenshot = {
                base64,
                width: null, // We don't have metadata without sharp
                height: null,
                timestamp: Date.now(),
            };

            return { success: true, base64, width: null, height: null };
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            return { success: false, error: error.message };
        }
    }

    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: 1920,
                height: 1080,
            },
        });

        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }
        const source = sources[0];
        const buffer = source.thumbnail.toJPEG(70);
        const base64 = buffer.toString('base64');
        const size = source.thumbnail.getSize();

        return {
            success: true,
            base64,
            width: size.width,
            height: size.height,
        };
    } catch (error) {
        console.error('Failed to capture screenshot using desktopCapturer:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

module.exports = {
    createWindows,
    windowPool,
    fixedYPosition,
    getStoredApiKey,
    getStoredProvider,
    getCurrentModelInfo,
    captureScreenshot,
};