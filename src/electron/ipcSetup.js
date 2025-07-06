const setupIpcHandlers = require('./ipcHandlers');

function registerIpc(windowPool, ipcMain) {
    setupIpcHandlers(ipcMain, windowPool);
}

module.exports = { registerIpc }; 