const crypto = require('crypto');

function ipcRequest(req, channel, payload) {
    return new Promise((resolve, reject) => {
        // 즉시 브리지 상태 확인 - 문제있으면 바로 실패
        if (!req.bridge || typeof req.bridge.emit !== 'function') {
            reject(new Error('IPC bridge is not available'));
            return;
        }

        const responseChannel = `${channel}-${crypto.randomUUID()}`;
        
        req.bridge.once(responseChannel, (response) => {
            if (!response) {
                reject(new Error(`No response received from ${channel}`));
                return;
            }
            
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.error || `IPC request to ${channel} failed`));
            }
        });

        try {
            req.bridge.emit('web-data-request', channel, responseChannel, payload);
        } catch (error) {
            req.bridge.removeAllListeners(responseChannel);
            reject(new Error(`Failed to emit IPC request: ${error.message}`));
        }
    });
}

module.exports = { ipcRequest }; 