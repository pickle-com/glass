// ipcHandlers.js
// IPC handler registration logic

module.exports = function setupIpcHandlers(ipcMain, windowPool) {
    ipcMain.handle('window:minimize', (event, windowName) => {
        const win = windowPool.get(windowName);
        if (win && !win.isDestroyed()) win.minimize();
    });
    ipcMain.handle('window:maximize', (event, windowName) => {
        const win = windowPool.get(windowName);
        if (win && !win.isDestroyed()) win.maximize();
    });
    ipcMain.handle('window:close', (event, windowName) => {
        const win = windowPool.get(windowName);
        if (win && !win.isDestroyed()) win.close();
    });
    ipcMain.handle('window:isVisible', (event, windowName) => {
        const win = windowPool.get(windowName);
        return win && !win.isDestroyed() ? win.isVisible() : false;
    });
    ipcMain.handle('window:getBounds', (event, windowName) => {
        const win = windowPool.get(windowName);
        return win && !win.isDestroyed() ? win.getBounds() : null;
    });
}; 