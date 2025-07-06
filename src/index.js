// try {
//     const reloader = require('electron-reloader');
//     reloader(module, {
//     });
// } catch (err) {
// }

require('dotenv').config();

if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const { createWindows } = require('./electron/windowManager.js');
const ListenService = require('./features/listen/listenService');
const { initializeFirebase } = require('./common/services/firebaseClient');
const databaseInitializer = require('./common/services/databaseInitializer');
const authService = require('./common/services/authService');
const path = require('node:path');
const { Deeplink } = require('electron-deeplink');
const express = require('express');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const settingsService = require('./features/settings/settingsService');
const sessionRepository = require('./common/repositories/session');

const eventBridge = new EventEmitter();
let WEB_PORT = 3000;

const listenService = new ListenService();
// Make listenService globally accessible so other modules (e.g., windowManager, askService) can reuse the same instance
global.listenService = listenService;
let deeplink = null; // Initialize as null
let pendingDeepLinkUrl = null; // Store any deep link that arrives before initialization

function createMainWindows() {
    createWindows();

    const { windowPool } = require('./electron/windowManager');
    const headerWindow = windowPool.get('header');
    
    // Initialize deeplink after windows are created
    if (!deeplink && headerWindow) {
        try {
            deeplink = new Deeplink({
                app,
                mainWindow: headerWindow,     
                protocol: 'pickleglass',
                isDev: !app.isPackaged,
                debugLogging: true
            });
            
            deeplink.on('received', (url) => {
                console.log('[deeplink] received:', url);
                handleCustomUrl(url);
            });
            
            console.log('[deeplink] Initialized with main window');
            
            // Handle any pending deep link
            if (pendingDeepLinkUrl) {
                console.log('[deeplink] Processing pending deep link:', pendingDeepLinkUrl);
                handleCustomUrl(pendingDeepLinkUrl);
                pendingDeepLinkUrl = null;
            }
        } catch (error) {
            console.error('[deeplink] Failed to initialize deep link:', error);
            deeplink = null;
        }
    }
}

app.whenReady().then(async () => {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            const { windowPool } = require('./electron/windowManager');
            if (windowPool) {
                const header = windowPool.get('header');
                if (header) {
                    if (header.isMinimized()) header.restore();
                    header.focus();
                    return;
                }
            }
            
            const windows = BrowserWindow.getAllWindows();
            if (windows.length > 0) {
                const mainWindow = windows[0];
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        });
    }

    initializeFirebase();
    
    databaseInitializer.initialize()
        .then(() => {
            console.log('>>> [index.js] Database initialized successfully');
            
            // Clean up any zombie sessions from previous runs first
            sessionRepository.endAllActiveSessions();

            authService.initialize();
            listenService.setupIpcHandlers();
            askService.initialize();
            settingsService.initialize();
            setupGeneralIpcHandlers();
        })
        .catch(err => {
            console.error('>>> [index.js] Database initialization failed - some features may not work', err);
        });

    WEB_PORT = await startWebStack();
    console.log('Web front-end listening on', WEB_PORT);
    
    createMainWindows();

    initAutoUpdater();
});

app.on('window-all-closed', () => {
    listenService.stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    console.log('[Shutdown] App is about to quit.');
    listenService.stopMacOSAudioCapture();
    await sessionRepository.endAllActiveSessions();
    databaseInitializer.close();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindows();
    }
});

// Add macOS native deep link handling as fallback
app.on('open-url', (event, url) => {
    event.preventDefault();
    console.log('[app] open-url received:', url);
    
    if (!deeplink) {
        // Store the URL if deeplink isn't ready yet
        pendingDeepLinkUrl = url;
        console.log('[app] Deep link stored for later processing');
    } else {
        handleCustomUrl(url);
    }
});

// Ensure app can handle the protocol
app.setAsDefaultProtocolClient('pickleglass');

function setupGeneralIpcHandlers() {
    const userRepository = require('./common/repositories/user');
    const presetRepository = require('./common/repositories/preset');

    ipcMain.handle('save-api-key', async (event, apiKey) => {
        try {
            await userRepository.saveApiKey(apiKey, authService.getCurrentUserId());
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('api-key-updated');
            });
            return { success: true };
        } catch (error) {
            console.error('IPC: Failed to save API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-user-presets', async () => {
        return await presetRepository.getPresets(authService.getCurrentUserId());
    });

    ipcMain.handle('get-preset-templates', async () => {
        return await presetRepository.getPresetTemplates();
    });

    ipcMain.handle('start-firebase-auth', async () => {
        try {
            const authUrl = `http://localhost:${WEB_PORT}/login?mode=electron`;
            console.log(`[Auth] Opening Firebase auth URL in browser: ${authUrl}`);
            await shell.openExternal(authUrl);
            return { success: true };
        } catch (error) {
            console.error('[Auth] Failed to open Firebase auth URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-web-url', () => {
        return process.env.pickleglass_WEB_URL || 'http://localhost:3000';
    });

    ipcMain.handle('get-current-user', async () => {
        return authService.getCurrentUser();
    });

    // --- Web UI Data Handlers (New) ---
    setupWebDataHandlers();
}

function setupWebDataHandlers() {
    const sessionRepository = require('./common/repositories/session');
    const sttRepository = require('./features/listen/stt/repositories');
    const summaryRepository = require('./features/listen/summary/repositories');
    const askRepository = require('./features/ask/repositories');
    const userRepository = require('./common/repositories/user');
    const presetRepository = require('./common/repositories/preset');

    const handleRequest = async (channel, responseChannel, payload) => {
        let result;
        const currentUserId = authService.getCurrentUserId();
        try {
            switch (channel) {
                // SESSION
                case 'get-sessions':
                    result = await sessionRepository.getAllByUserId(currentUserId);
                    break;
                case 'get-session-details':
                    const session = await sessionRepository.getById(payload);
                    if (!session) {
                        result = null;
                        break;
                    }
                    const transcripts = await sttRepository.getAllTranscriptsBySessionId(payload);
                    const ai_messages = await askRepository.getAllAiMessagesBySessionId(payload);
                    const summary = await summaryRepository.getSummaryBySessionId(payload);
                    result = { session, transcripts, ai_messages, summary };
                    break;
                case 'delete-session':
                    result = await sessionRepository.deleteWithRelatedData(payload);
                    break;
                case 'create-session':
                    const id = await sessionRepository.create(currentUserId, 'ask');
                    if (payload.title) {
                        await sessionRepository.updateTitle(id, payload.title);
                    }
                    result = { id };
                    break;
                
                // USER
                case 'get-user-profile':
                    result = await userRepository.getById(currentUserId);
                    break;
                case 'update-user-profile':
                    result = await userRepository.update({ uid: currentUserId, ...payload });
                    break;
                case 'find-or-create-user':
                    result = await userRepository.findOrCreate(payload);
                    break;
                case 'save-api-key':
                    result = await userRepository.saveApiKey(payload, currentUserId);
                    break;
                case 'check-api-key-status':
                    const user = await userRepository.getById(currentUserId);
                    result = { hasApiKey: !!user?.api_key && user.api_key.length > 0 };
                    break;
                case 'delete-account':
                    result = await userRepository.deleteById(currentUserId);
                    break;

                // PRESET
                case 'get-presets':
                    result = await presetRepository.getPresets(currentUserId);
                    break;
                case 'create-preset':
                    result = await presetRepository.create({ ...payload, uid: currentUserId });
                    settingsService.notifyPresetUpdate('created', result.id, payload.title);
                    break;
                case 'update-preset':
                    result = await presetRepository.update(payload.id, payload.data, currentUserId);
                    settingsService.notifyPresetUpdate('updated', payload.id, payload.data.title);
                    break;
                case 'delete-preset':
                    result = await presetRepository.delete(payload, currentUserId);
                    settingsService.notifyPresetUpdate('deleted', payload);
                    break;
                
                // BATCH
                case 'get-batch-data':
                    const includes = payload ? payload.split(',').map(item => item.trim()) : ['profile', 'presets', 'sessions'];
                    const batchResult = {};
            
                    if (includes.includes('profile')) {
                        batchResult.profile = await userRepository.getById(currentUserId);
                    }
                    if (includes.includes('presets')) {
                        batchResult.presets = await presetRepository.getPresets(currentUserId);
                    }
                    if (includes.includes('sessions')) {
                        batchResult.sessions = await sessionRepository.getAllByUserId(currentUserId);
                    }
                    result = batchResult;
                    break;

                default:
                    throw new Error(`Unknown web data channel: ${channel}`);
            }
            eventBridge.emit(responseChannel, { success: true, data: result });
        } catch (error) {
            console.error(`Error handling web data request for ${channel}:`, error);
            eventBridge.emit(responseChannel, { success: false, error: error.message });
        }
    };
    
    eventBridge.on('web-data-request', handleRequest);
}

async function handleCustomUrl(url) {
    try {
        console.log('[Custom URL] Processing URL:', url);
        
        const urlObj = new URL(url);
        const action = urlObj.hostname;
        const params = Object.fromEntries(urlObj.searchParams);
        
        console.log('[Custom URL] Action:', action, 'Params:', params);

        switch (action) {
            case 'login':
            case 'auth-success':
                await handleFirebaseAuthCallback(params);
                break;
            case 'personalize':
                handlePersonalizeFromUrl(params);
                break;
            default:
                const { windowPool } = require('./electron/windowManager');
                const header = windowPool.get('header');
                if (header) {
                    if (header.isMinimized()) header.restore();
                    header.focus();
                    
                    const targetUrl = `http://localhost:${WEB_PORT}/${action}`;
                    console.log(`[Custom URL] Navigating webview to: ${targetUrl}`);
                    header.webContents.loadURL(targetUrl);
                }
        }

    } catch (error) {
        console.error('[Custom URL] Error parsing URL:', error);
    }
}

async function handleFirebaseAuthCallback(params) {
    const userRepository = require('./common/repositories/user');
    const { token: idToken } = params;

    if (!idToken) {
        console.error('[Auth] Firebase auth callback is missing ID token.');
        // No need to send IPC, the UI won't transition without a successful auth state change.
        return;
    }

    console.log('[Auth] Received ID token from deep link, exchanging for custom token...');

    try {
        const functionUrl = 'https://us-west1-pickle-3651a.cloudfunctions.net/pickleGlassAuthCallback';
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to exchange token.');
        }

        const { customToken, user } = data;
        console.log('[Auth] Successfully received custom token for user:', user.uid);

        const firebaseUser = {
            uid: user.uid,
            email: user.email || 'no-email@example.com',
            displayName: user.name || 'User',
            photoURL: user.picture
        };

        // 1. Sync user data to local DB
        await userRepository.findOrCreate(firebaseUser);
        console.log('[Auth] User data synced with local DB.');

        // 2. Sign in using the authService in the main process
        await authService.signInWithCustomToken(customToken);
        console.log('[Auth] Main process sign-in initiated. Waiting for onAuthStateChanged...');

        // 3. Focus the app window
        const { windowPool } = require('./electron/windowManager');
        const header = windowPool.get('header');
        if (header) {
            if (header.isMinimized()) header.restore();
            header.focus();
        } else {
            console.error('[Auth] Header window not found after auth callback.');
        }
        
    } catch (error) {
        console.error('[Auth] Error during custom token exchange or sign-in:', error);
        // The UI will not change, and the user can try again.
        // Optionally, send a generic error event to the renderer.
        const { windowPool } = require('./electron/windowManager');
        const header = windowPool.get('header');
        if (header) {
            header.webContents.send('auth-failed', { message: error.message });
        }
    }
}

function handlePersonalizeFromUrl(params) {
    console.log('[Custom URL] Personalize params:', params);
    
    const { windowPool } = require('./electron/windowManager');
    const header = windowPool.get('header');
    
    if (header) {
        if (header.isMinimized()) header.restore();
        header.focus();
        
        const personalizeUrl = `http://localhost:${WEB_PORT}/settings`;
        console.log(`[Custom URL] Navigating to personalize page: ${personalizeUrl}`);
        header.webContents.loadURL(personalizeUrl);
        
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('enter-personalize-mode', {
                message: 'Personalization mode activated',
                params: params
            });
        });
    } else {
        console.error('[Custom URL] Header window not found for personalize');
    }
}


async function startWebStack() {
  console.log('NODE_ENV =', process.env.NODE_ENV); 
  const isDev = !app.isPackaged;

  const getAvailablePort = () => {
    return new Promise((resolve, reject) => {
      const server = require('net').createServer();
      server.listen(0, (err) => {
        if (err) reject(err);
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  };

  const apiPort = await getAvailablePort();
  const frontendPort = await getAvailablePort();

  console.log(`🔧 Allocated ports: API=${apiPort}, Frontend=${frontendPort}`);

  process.env.pickleglass_API_PORT = apiPort.toString();
  process.env.pickleglass_API_URL = `http://localhost:${apiPort}`;
  process.env.pickleglass_WEB_PORT = frontendPort.toString();
  process.env.pickleglass_WEB_URL = `http://localhost:${frontendPort}`;

  console.log(`🌍 Environment variables set:`, {
    pickleglass_API_URL: process.env.pickleglass_API_URL,
    pickleglass_WEB_URL: process.env.pickleglass_WEB_URL
  });

  const createBackendApp = require('../pickleglass_web/backend_node');
  const nodeApi = createBackendApp(eventBridge);

  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, 'out')
    : path.join(__dirname, '..', 'pickleglass_web', 'out');

  const fs = require('fs');

  if (!fs.existsSync(staticDir)) {
    console.error(`============================================================`);
    console.error(`[ERROR] Frontend build directory not found!`);
    console.error(`Path: ${staticDir}`);
    console.error(`Please run 'npm run build' inside the 'pickleglass_web' directory first.`);
    console.error(`============================================================`);
    app.quit();
    return;
  }

  const runtimeConfig = {
    API_URL: `http://localhost:${apiPort}`,
    WEB_URL: `http://localhost:${frontendPort}`,
    timestamp: Date.now()
  };
  
  // 쓰기 가능한 임시 폴더에 런타임 설정 파일 생성
  const tempDir = app.getPath('temp');
  const configPath = path.join(tempDir, 'runtime-config.json');
  fs.writeFileSync(configPath, JSON.stringify(runtimeConfig, null, 2));
  console.log(`📝 Runtime config created in temp location: ${configPath}`);

  const frontSrv = express();
  
  // 프론트엔드에서 /runtime-config.json을 요청하면 임시 폴더의 파일을 제공
  frontSrv.get('/runtime-config.json', (req, res) => {
    res.sendFile(configPath);
  });

  frontSrv.use((req, res, next) => {
    if (req.path.indexOf('.') === -1 && req.path !== '/') {
      const htmlPath = path.join(staticDir, req.path + '.html');
      if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
      }
    }
    next();
  });
  
  frontSrv.use(express.static(staticDir));
  
  const frontendServer = await new Promise((resolve, reject) => {
    const server = frontSrv.listen(frontendPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });

  console.log(`✅ Frontend server started on http://localhost:${frontendPort}`);

  const apiSrv = express();
  apiSrv.use(nodeApi);

  const apiServer = await new Promise((resolve, reject) => {
    const server = apiSrv.listen(apiPort, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
    app.once('before-quit', () => server.close());
  });

  console.log(`✅ API server started on http://localhost:${apiPort}`);

  console.log(`🚀 All services ready:`);
  console.log(`   Frontend: http://localhost:${frontendPort}`);
  console.log(`   API:      http://localhost:${apiPort}`);

  return frontendPort;
}

// Auto-update initialization
function initAutoUpdater() {
    try {
        // Skip auto-updater in development mode
        if (!app.isPackaged) {
            console.log('[AutoUpdater] Skipped in development (app is not packaged)');
            return;
        }

        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'pickle-com',
            repo: 'glass',
        });

        // Immediately check for updates & notify
        autoUpdater.checkForUpdatesAndNotify()
            .catch(err => {
                console.error('[AutoUpdater] Error checking for updates:', err);
            });

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Checking for updates…');
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[AutoUpdater] Update available:', info.version);
        });

        autoUpdater.on('update-not-available', () => {
            console.log('[AutoUpdater] Application is up-to-date');
        });

        autoUpdater.on('error', (err) => {
            console.error('[AutoUpdater] Error while updating:', err);
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log(`[AutoUpdater] Update downloaded: ${info.version}`);

            const dialogOpts = {
                type: 'info',
                buttons: ['Install now', 'Install on next launch'],
                title: 'Update Available',
                message: 'A new version of Glass is ready to be installed.',
                defaultId: 0,
                cancelId: 1
            };

            dialog.showMessageBox(dialogOpts).then((returnValue) => {
                // returnValue.response 0 is for 'Install Now'
                if (returnValue.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
    } catch (e) {
        console.error('[AutoUpdater] Failed to initialise:', e);
    }
}