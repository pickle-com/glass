const { ipcMain } = require('electron');
const os = require('os');

// Register missing IPC handlers
function registerPermissionHandlers() {
    ipcMain.handle('check-system-permissions', async () => {
        // Implement a basic permissions check that always returns success for now
        return {
            screen: true,
            audio: true,
            accessibility: true
        };
    });
    
    console.log('Permission handlers registered');
}

module.exports = { registerPermissionHandlers };