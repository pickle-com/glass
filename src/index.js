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

const { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, session } = require('electron');
const { createWindows } = require('./electron/windowManager.js');
const ListenService = require('./features/listen/listenService');
const { initializeFirebase } = require('./common/services/firebaseClient');
const databaseInitializer = require('./common/services/databaseInitializer');
const authService = require('./common/services/authService');
const path = require('node:path');
const express = require('express');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const settingsService = require('./features/settings/settingsService');
const sessionRepository = require('./common/repositories/session');
const ModelStateService = require('./common/services/modelStateService');
const sqliteClient = require('./common/services/sqliteClient');

const eventBridge = new EventEmitter();
let WEB_PORT = 3000;

const listenService = new ListenService();
// Make listenService globally accessible so other modules (e.g., windowManager, askService) can reuse the same instance
global.listenService = listenService;

//////// after_modelStateService ////////
const modelStateService = new ModelStateService(authService);
global.modelStateService = modelStateService;
//////// after_modelStateService ////////

// Native deep link handling - cross-platform compatible
let pendingDeepLinkUrl = null;

function setupProtocolHandling() {
    // Protocol registration - must be done before app is ready
    try {
        if (!app.isDefaultProtocolClient('pickleglass')) {
            const success = app.setAsDefaultProtocolClient('pickleglass');
            if (success) {
                console.log('[Protocol] Successfully set as default protocol client for pickleglass://');
            } else {
                console.warn('[Protocol] Failed to set as default protocol client - this may affect deep linking');
            }
        } else {
            console.log('[Protocol] Already registered as default protocol client for pickleglass://');
        }
    } catch (error) {
        console.error('[Protocol] Error during protocol registration:', error);
    }

    // Handle protocol URLs on Windows/Linux
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('[Protocol] Second instance command line:', commandLine);
        
        focusMainWindow();
        
        let protocolUrl = null;
        
        // Search through all command line arguments for a valid protocol URL
        for (const arg of commandLine) {
            if (arg && typeof arg === 'string' && arg.startsWith('pickleglass://')) {
                // Clean up the URL by removing problematic characters
                const cleanUrl = arg.replace(/[\\₩]/g, '');
                
                // Additional validation for Windows
                if (process.platform === 'win32') {
                    // On Windows, ensure the URL doesn't contain file path indicators
                    if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                        protocolUrl = cleanUrl;
                        break;
                    }
                } else {
                    protocolUrl = cleanUrl;
                    break;
                }
            }
        }
        
        if (protocolUrl) {
            console.log('[Protocol] Valid URL found from second instance:', protocolUrl);
            handleCustomUrl(protocolUrl);
        } else {
            console.log('[Protocol] No valid protocol URL found in command line arguments');
            console.log('[Protocol] Command line args:', commandLine);
        }
    });

    // Handle protocol URLs on macOS
    app.on('open-url', (event, url) => {
        event.preventDefault();
        console.log('[Protocol] Received URL via open-url:', url);
        
        if (!url || !url.startsWith('pickleglass://')) {
            console.warn('[Protocol] Invalid URL format:', url);
            return;
        }

        if (app.isReady()) {
            handleCustomUrl(url);
        } else {
            pendingDeepLinkUrl = url;
            console.log('[Protocol] App not ready, storing URL for later');
        }
    });
}

function focusMainWindow() {
    const { windowPool } = require('./electron/windowManager');
    if (windowPool) {
        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            if (header.isMinimized()) header.restore();
            header.focus();
            return true;
        }
    }
    
    // Fallback: focus any available window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        const mainWindow = windows[0];
        if (!mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            return true;
        }
    }
    
    return false;
}

if (process.platform === 'win32') {
    for (const arg of process.argv) {
        if (arg && typeof arg === 'string' && arg.startsWith('pickleglass://')) {
            // Clean up the URL by removing problematic characters (korean characters issue...)
            const cleanUrl = arg.replace(/[\\₩]/g, '');
            
            if (!cleanUrl.includes(':') || cleanUrl.indexOf('://') === cleanUrl.lastIndexOf(':')) {
                console.log('[Protocol] Found protocol URL in initial arguments:', cleanUrl);
                pendingDeepLinkUrl = cleanUrl;
                break;
            }
        }
    }
    
    console.log('[Protocol] Initial process.argv:', process.argv);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

// setup protocol after single instance lock
setupProtocolHandling();

app.whenReady().then(async () => {

    // Setup native loopback audio capture for Windows
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
            // Grant access to the first screen found with loopback audio
            callback({ video: sources[0], audio: 'loopback' });
        }).catch((error) => {
            console.error('Failed to get desktop capturer sources:', error);
            callback({});
        });
    });

    // Initialize core services
    initializeFirebase();
    
    try {
        await databaseInitializer.initialize();
        console.log('>>> [index.js] Database initialized successfully');
        
        // Clean up zombie sessions from previous runs first
        sessionRepository.endAllActiveSessions();

        authService.initialize();

        //////// after_modelStateService ////////
        modelStateService.initialize();
        //////// after_modelStateService ////////

        listenService.setupIpcHandlers();
        askService.initialize();
        settingsService.initialize();
        setupGeneralIpcHandlers();

        // Start web server and create windows ONLY after all initializations are successful
        WEB_PORT = await startWebStack();
        console.log('Web front-end listening on', WEB_PORT);
        
        createWindows();

    } catch (err) {
        console.error('>>> [index.js] Database initialization failed - some features may not work', err);
        // Optionally, show an error dialog to the user
        dialog.showErrorBox(
            'Application Error',
            'A critical error occurred during startup. Some features might be disabled. Please restart the application.'
        );
    }

    initAutoUpdater();

    // Process any pending deep link after everything is initialized
    if (pendingDeepLinkUrl) {
        console.log('[Protocol] Processing pending URL:', pendingDeepLinkUrl);
        handleCustomUrl(pendingDeepLinkUrl);
        pendingDeepLinkUrl = null;
    }
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
        createWindows();
    }
});

function setupGeneralIpcHandlers() {
    const userRepository = require('./common/repositories/user');
    const presetRepository = require('./common/repositories/preset');

    ipcMain.handle('save-api-key', (event, apiKey) => {
        try {
            userRepository.saveApiKey(apiKey, authService.getCurrentUserId());
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('api-key-updated');
            });
            return { success: true };
        } catch (error) {
            console.error('IPC: Failed to save API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-user-presets', () => {
        return presetRepository.getPresets(authService.getCurrentUserId());
    });

    ipcMain.handle('get-preset-templates', () => {
        return presetRepository.getPresetTemplates();
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

    ipcMain.handle('get-current-user', () => {
        return authService.getCurrentUser();
    });

    ipcMain.handle('get-auto-update', () => {
        const uid = authService.getCurrentUserId();
        try {
            return sqliteClient.getAutoUpdate(uid);
        } catch (error) {
            console.error('Error getting auto-update setting:', error);
            return true; // fallback to enabled
        }
    });

    ipcMain.handle('set-auto-update', (event, isEnabled) => {
        const uid = authService.getCurrentUserId();
        try {
            sqliteClient.setAutoUpdate(isEnabled, uid);
            return true;
        } catch (error) {
            console.error('Error setting auto-update:', error);
            return false;
        }
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

    const handleRequest = (channel, responseChannel, payload) => {
        let result;
        const currentUserId = authService.getCurrentUserId();
        try {
            switch (channel) {
                // SESSION
                case 'get-sessions':
                    result = sessionRepository.getAllByUserId(currentUserId);
                    break;
                case 'get-session-details':
                    const session = sessionRepository.getById(payload);
                    if (!session) {
                        result = null;
                        break;
                    }
                    const transcripts = sttRepository.getAllTranscriptsBySessionId(payload);
                    const ai_messages = askRepository.getAllAiMessagesBySessionId(payload);
                    const summary = summaryRepository.getSummaryBySessionId(payload);
                    result = { session, transcripts, ai_messages, summary };
                    break;
                case 'delete-session':
                    result = sessionRepository.deleteWithRelatedData(payload);
                    break;
                case 'create-session':
                    const id = sessionRepository.create(currentUserId, 'ask');
                    if (payload.title) {
                        sessionRepository.updateTitle(id, payload.title);
                    }
                    result = { id };
                    break;
                
                // USER
                case 'get-user-profile':
                    result = userRepository.getById(currentUserId);
                    break;
                case 'update-user-profile':
                    result = userRepository.update({ uid: currentUserId, ...payload });
                    break;
                case 'find-or-create-user':
                    result = userRepository.findOrCreate(payload);
                    break;
                case 'save-api-key':
                    result = userRepository.saveApiKey(payload, currentUserId);
                    break;
                case 'check-api-key-status':
                    const user = userRepository.getById(currentUserId);
                    result = { hasApiKey: !!user?.api_key && user.api_key.length > 0 };
                    break;
                case 'delete-account':
                    result = userRepository.deleteById(currentUserId);
                    break;

                // PRESET
                case 'get-presets':
                    result = presetRepository.getPresets(currentUserId);
                    break;
                case 'create-preset':
                    result = presetRepository.create({ ...payload, uid: currentUserId });
                    settingsService.notifyPresetUpdate('created', result.id, payload.title);
                    break;
                case 'update-preset':
                    result = presetRepository.update(payload.id, payload.data, currentUserId);
                    settingsService.notifyPresetUpdate('updated', payload.id, payload.data.title);
                    break;
                case 'delete-preset':
                    result = presetRepository.delete(payload, currentUserId);
                    settingsService.notifyPresetUpdate('deleted', payload);
                    break;
                
                // BATCH
                case 'get-batch-data':
                    const includes = payload ? payload.split(',').map(item => item.trim()) : ['profile', 'presets', 'sessions'];
                    const batchResult = {};
            
                    if (includes.includes('profile')) {
                        batchResult.profile = userRepository.getById(currentUserId);
                    }
                    if (includes.includes('presets')) {
                        batchResult.presets = presetRepository.getPresets(currentUserId);
                    }
                    if (includes.includes('sessions')) {
                        batchResult.sessions = sessionRepository.getAllByUserId(currentUserId);
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
        
        // Validate and clean URL
        if (!url || typeof url !== 'string' || !url.startsWith('pickleglass://')) {
            console.error('[Custom URL] Invalid URL format:', url);
            return;
        }
        
        // Clean up URL by removing problematic characters
        const cleanUrl = url.replace(/[\\₩]/g, '');
        
        // Additional validation
        if (cleanUrl !== url) {
            console.log('[Custom URL] Cleaned URL from:', url, 'to:', cleanUrl);
            url = cleanUrl;
        }
        
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
        userRepository.findOrCreate(firebaseUser);
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
        const autoUpdateEnabled = sqliteClient.getAutoUpdate();
        if (!autoUpdateEnabled) {
            console.log('[AutoUpdater] Skipped because auto-updates are disabled in settings');
            return;
        }
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