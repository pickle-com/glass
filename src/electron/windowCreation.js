const { BrowserWindow, app } = require('electron');
const path = require('node:path');

function assertIsMap(windowPool) {
    if (!(windowPool instanceof Map)) {
        throw new TypeError('windowPool must be a Map');
    }
}

function createFeatureWindows(windowPool, header, isContentProtectionOn, shouldUseLiquidGlass, liquidGlass) {
    assertIsMap(windowPool);
    if (windowPool.has('listen')) return;

    const commonChildOptions = {
        parent: header,
        show: false,
        frame: false,
        transparent: true,
        vibrancy: false,
        hasShadow: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
    };

    // listen
    const listen = new BrowserWindow({
        ...commonChildOptions, width:400,minWidth:400,maxWidth:400,
        maxHeight:700,
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
            const viewId = liquidGlass.addView(listen.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
            }
        });
    }
    windowPool.set('listen', listen);

    // ask
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
            const viewId = liquidGlass.addView(ask.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
            }
        });
    }
    ask.on('blur',()=>ask.webContents.send('window-blur'));
    if (!app.isPackaged) {
        ask.webContents.openDevTools({ mode: 'detach' });
    }
    windowPool.set('ask', ask);

    // settings
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
            const viewId = liquidGlass.addView(settings.getNativeWindowHandle(), {
                cornerRadius: 12,
                tintColor: '#FF00001A', // Red tint
                opaque: false, 
            });
            if (viewId !== -1) {
                liquidGlass.unstable_setVariant(viewId, 2);
            }
        });
    }
    windowPool.set('settings', settings);   
}

function destroyFeatureWindows(windowPool, featureWindows, settingsHideTimer) {
    assertIsMap(windowPool);
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

module.exports = {
    createFeatureWindows,
    destroyFeatureWindows,
}; 