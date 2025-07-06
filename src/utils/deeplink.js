const { app, shell } = require('electron');

class SimpleDeeplink {
    constructor(options) {
        this.app = options.app;
        this.mainWindow = options.mainWindow;
        this.protocol = options.protocol;
        this.isDev = options.isDev || false;
        this.debugLogging = options.debugLogging || false;
        this.listeners = new Map();
        
        this.setupProtocolHandling();
    }
    
    setupProtocolHandling() {
        // Set up the protocol handler
        if (process.platform === 'darwin') {
            // macOS handles this via the app.on('open-url') event
            this.app.on('open-url', (event, url) => {
                event.preventDefault();
                this.log('open-url received:', url);
                this.emit('received', url);
            });
        } else {
            // Windows/Linux handle this via command line arguments
            const gotTheLock = this.app.requestSingleInstanceLock();
            if (!gotTheLock) {
                this.app.quit();
                return;
            }
            
            this.app.on('second-instance', (event, commandLine, workingDirectory) => {
                // Look for protocol URL in command line arguments
                const url = commandLine.find(arg => arg.startsWith(this.protocol + '://'));
                if (url) {
                    this.log('second-instance URL received:', url);
                    this.emit('received', url);
                }
                
                // Focus the main window
                if (this.mainWindow) {
                    if (this.mainWindow.isMinimized()) {
                        this.mainWindow.restore();
                    }
                    this.mainWindow.focus();
                }
            });
            
            // Check for protocol URL in initial command line arguments
            const url = process.argv.find(arg => arg.startsWith(this.protocol + '://'));
            if (url) {
                this.log('initial URL received:', url);
                // Delay emission to ensure listeners are set up
                setTimeout(() => {
                    this.emit('received', url);
                }, 1000);
            }
        }
        
        // Set as default protocol client
        this.app.setAsDefaultProtocolClient(this.protocol);
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in deeplink event handler for ${event}:`, error);
                }
            });
        }
    }
    
    log(...args) {
        if (this.debugLogging) {
            console.log('[deeplink]', ...args);
        }
    }
}

module.exports = { Deeplink: SimpleDeeplink }; 