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
const { createWindows } = require('./window/windowManager.js');
const listenService = require('./features/listen/listenService');
const { initializeFirebase } = require('./features/common/services/firebaseClient');
const databaseInitializer = require('./features/common/services/databaseInitializer');
const authService = require('./features/common/services/authService');
const path = require('node:path');
const express = require('express');
const fetch = require('node-fetch');
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const askService = require('./features/ask/askService');
const settingsService = require('./features/settings/settingsService');
const sessionRepository = require('./features/common/repositories/session');
const modelStateService = require('./features/common/services/modelStateService');
const featureBridge = require('./bridge/featureBridge');
const windowBridge = require('./bridge/windowBridge');

// Global variables
const eventBridge = new EventEmitter();
let WEB_PORT = 3000;
let isShuttingDown = false; // Flag to prevent infinite shutdown loop

//////// after_modelStateService ////////
global.modelStateService = modelStateService;
//////// after_modelStateService ////////

// Import and initialize OllamaService
const ollamaService = require('./features/common/services/ollamaService');
const ollamaModelRepository = require('./features/common/repositories/ollamaModel');

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
    const { windowPool } = require('./window/windowManager.js');
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
        
        // Clean up zombie sessions from previous runs first - MOVED TO authService
        // sessionRepository.endAllActiveSessions();

        await authService.initialize();

        //////// after_modelStateService ////////
        await modelStateService.initialize();
        //////// after_modelStateService ////////

        featureBridge.initialize();  // 추가: featureBridge 초기화
        windowBridge.initialize();
        setupWebDataHandlers();

        // Initialize Ollama models in database
        await ollamaModelRepository.initializeDefaultModels();

        // Auto warm-up selected Ollama model in background (non-blocking)
        setTimeout(async () => {
            try {
                console.log('[index.js] Starting background Ollama model warm-up...');
                await ollamaService.autoWarmUpSelectedModel();
            } catch (error) {
                console.log('[index.js] Background warm-up failed (non-critical):', error.message);
            }
        }, 2000); // Wait 2 seconds after app start

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

    // initAutoUpdater should be called after auth is initialized
    initAutoUpdater();

    // Process any pending deep link after everything is initialized
    if (pendingDeepLinkUrl) {
        console.log('[Protocol] Processing pending URL:', pendingDeepLinkUrl);
        handleCustomUrl(pendingDeepLinkUrl);
        pendingDeepLinkUrl = null;
    }
});

app.on('before-quit', async (event) => {
    // Prevent infinite loop by checking if shutdown is already in progress
    if (isShuttingDown) {
        console.log('[Shutdown] 🔄 Shutdown already in progress, allowing quit...');
        return;
    }
    
    console.log('[Shutdown] App is about to quit. Starting graceful shutdown...');
    
    // Set shutdown flag to prevent infinite loop
    isShuttingDown = true;
    
    // Prevent immediate quit to allow graceful shutdown
    event.preventDefault();
    
    try {
        // 1. Stop audio capture first (immediate)
        await listenService.closeSession();
        console.log('[Shutdown] Audio capture stopped');
        
        // 2. End all active sessions (database operations) - with error handling
        try {
            await sessionRepository.endAllActiveSessions();
            console.log('[Shutdown] Active sessions ended');
        } catch (dbError) {
            console.warn('[Shutdown] Could not end active sessions (database may be closed):', dbError.message);
        }
        
        // 3. Shutdown Ollama service (potentially time-consuming)
        console.log('[Shutdown] shutting down Ollama service...');
        const ollamaShutdownSuccess = await Promise.race([
            ollamaService.shutdown(false), // Graceful shutdown
            new Promise(resolve => setTimeout(() => resolve(false), 8000)) // 8s timeout
        ]);
        
        if (ollamaShutdownSuccess) {
            console.log('[Shutdown] Ollama service shut down gracefully');
        } else {
            console.log('[Shutdown] Ollama shutdown timeout, forcing...');
            // Force shutdown if graceful failed
            try {
                await ollamaService.shutdown(true);
            } catch (forceShutdownError) {
                console.warn('[Shutdown] Force shutdown also failed:', forceShutdownError.message);
            }
        }
        
        // 4. Close database connections (final cleanup)
        try {
            databaseInitializer.close();
            console.log('[Shutdown] Database connections closed');
        } catch (closeError) {
            console.warn('[Shutdown] Error closing database:', closeError.message);
        }
        
        console.log('[Shutdown] Graceful shutdown completed successfully');
        
    } catch (error) {
        console.error('[Shutdown] Error during graceful shutdown:', error);
        // Continue with shutdown even if there were errors
    } finally {
        // Actually quit the app now
        console.log('[Shutdown] Exiting application...');
        app.exit(0); // Use app.exit() instead of app.quit() to force quit
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindows();
    }
});

function setupWebDataHandlers() {
    const sessionRepository = require('./features/common/repositories/session');
    const sttRepository = require('./features/listen/stt/repositories');
    const summaryRepository = require('./features/listen/summary/repositories');
    const askRepository = require('./features/ask/repositories');
    const userRepository = require('./features/common/repositories/user');
    const presetRepository = require('./features/common/repositories/preset');

    const handleRequest = async (channel, responseChannel, payload) => {
        let result;
        // const currentUserId = authService.getCurrentUserId(); // No longer needed here
        try {
            switch (channel) {
                // SESSION
                case 'get-sessions':
                    // Adapter injects UID
                    result = await sessionRepository.getAllByUserId();
                    break;
                case 'get-session-details':
                    const session = await sessionRepository.getById(payload);
                    if (!session) {
                        result = null;
                        break;
                    }
                    const [transcripts, ai_messages, summary] = await Promise.all([
                        sttRepository.getAllTranscriptsBySessionId(payload),
                        askRepository.getAllAiMessagesBySessionId(payload),
                        summaryRepository.getSummaryBySessionId(payload)
                    ]);
                    result = { session, transcripts, ai_messages, summary };
                    break;
                case 'delete-session':
                    result = await sessionRepository.deleteWithRelatedData(payload);
                    break;
                case 'create-session':
                    // Adapter injects UID
                    const id = await sessionRepository.create('ask');
                    if (payload && payload.title) {
                        await sessionRepository.updateTitle(id, payload.title);
                    }
                    result = { id };
                    break;
                
                // USER
                case 'get-user-profile':
                    // Adapter injects UID
                    result = await userRepository.getById();
                    break;
                case 'update-user-profile':
                     // Adapter injects UID
                    result = await userRepository.update(payload);
                    break;
                case 'find-or-create-user':
                    result = await userRepository.findOrCreate(payload);
                    break;
                case 'save-api-key':
                    // Use ModelStateService as the single source of truth for API key management
                    result = await modelStateService.setApiKey(payload.provider, payload.apiKey);
                    break;
                case 'check-api-key-status':
                    // Use ModelStateService to check API key status
                    const hasApiKey = await modelStateService.hasValidApiKey();
                    result = { hasApiKey };
                    break;
                case 'delete-account':
                    // Adapter injects UID
                    result = await userRepository.deleteById();
                    break;

                // PRESET
                case 'get-presets':
                    // Adapter injects UID
                    result = await presetRepository.getPresets();
                    break;
                case 'create-preset':
                    // Adapter injects UID
                    result = await presetRepository.create(payload);
                    settingsService.notifyPresetUpdate('created', result.id, payload.title);
                    break;
                case 'update-preset':
                    // Adapter injects UID
                    result = await presetRepository.update(payload.id, payload.data);
                    settingsService.notifyPresetUpdate('updated', payload.id, payload.data.title);
                    break;
                case 'delete-preset':
                    // Adapter injects UID
                    result = await presetRepository.delete(payload);
                    settingsService.notifyPresetUpdate('deleted', payload);
                    break;
                
                // BATCH
                case 'get-batch-data':
                    const includes = payload ? payload.split(',').map(item => item.trim()) : ['profile', 'presets', 'sessions'];
                    const promises = {};
            
                    if (includes.includes('profile')) {
                        // Adapter injects UID
                        promises.profile = userRepository.getById();
                    }
                    if (includes.includes('presets')) {
                        // Adapter injects UID
                        promises.presets = presetRepository.getPresets();
                    }
                    if (includes.includes('sessions')) {
                        // Adapter injects UID
                        promises.sessions = sessionRepository.getAllByUserId();
                    }
                    
                    const batchResult = {};
                    const promiseResults = await Promise.all(Object.values(promises));
                    Object.keys(promises).forEach((key, index) => {
                        batchResult[key] = promiseResults[index];
                    });

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
                const { windowPool } = require('./window/windowManager.js');
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
    const userRepository = require('./features/common/repositories/user');
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
        const { windowPool } = require('./window/windowManager.js');
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
        const { windowPool } = require('./window/windowManager.js');
        const header = windowPool.get('header');
        if (header) {
            header.webContents.send('auth-failed', { message: error.message });
        }
    }
}

function handlePersonalizeFromUrl(params) {
    console.log('[Custom URL] Personalize params:', params);
    
    const { windowPool } = require('./window/windowManager.js');
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

  console.log(`🚀 All services ready:
   Frontend: http://localhost:${frontendPort}
   API:      http://localhost:${apiPort}`);

  return frontendPort;
}

// Auto-update initialization
async function initAutoUpdater() {
    if (process.env.NODE_ENV === 'development') {
        console.log('Development environment, skipping auto-updater.');
        return;
    }

    try {
        await autoUpdater.checkForUpdates();
        autoUpdater.on('update-available', () => {
            console.log('Update available!');
            autoUpdater.downloadUpdate();
        });
        autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, date, url) => {
            console.log('Update downloaded:', releaseNotes, releaseName, date, url);
            dialog.showMessageBox({
                type: 'info',
                title: 'Application Update',
                message: `A new version of PickleGlass (${releaseName}) has been downloaded. It will be installed the next time you launch the application.`,
                buttons: ['Restart', 'Later']
            }).then(response => {
                if (response.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });
        autoUpdater.on('error', (err) => {
            console.error('Error in auto-updater:', err);
        });
    } catch (err) {
        console.error('Error initializing auto-updater:', err);
    }
}