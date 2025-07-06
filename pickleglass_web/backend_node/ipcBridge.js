const crypto = require('crypto');

function ipcRequest(req, channel, payload) {
    return new Promise((resolve, reject) => {
        const responseChannel = `${channel}-${crypto.randomUUID()}`;
        
        req.bridge.once(responseChannel, (response) => {
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.error || `IPC request to ${channel} failed`));
            }
        });

        req.bridge.emit('web-data-request', channel, responseChannel, payload);
    });
}

module.exports = { ipcRequest }; 