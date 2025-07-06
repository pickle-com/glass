// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    const validChannels = ['set-current-user', 'firebase-auth-success'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  sendSync: (channel, data) => {
    const validChannels = ['get-api-url-sync'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = ['api-key-updated'];
    if (validChannels.includes(channel)) {
      const newCallback = (_, ...args) => func(...args);
      ipcRenderer.on(channel, newCallback);
      return () => {
        ipcRenderer.removeListener(channel, newCallback);
      };
    }
  },
  invoke: (channel, ...args) => {
    const validChannels = ['save-api-key'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  removeAllListeners: (channel) => {
    const validChannels = ['api-key-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
