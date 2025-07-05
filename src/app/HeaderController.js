import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential, signInWithCustomToken, signOut } from 'firebase/auth';

import './AppHeader.js';
import './ApiKeyHeader.js';
import './PermissionSetup.js';

const firebaseConfig = {
    apiKey: 'AIzaSyAgtJrmsFWG1C7m9S55HyT1laICEzuUS2g',
    authDomain: 'pickle-3651a.firebaseapp.com',
    projectId: 'pickle-3651a',
    storageBucket: 'pickle-3651a.firebasestorage.app',
    messagingSenderId: '904706892885',
    appId: '1:904706892885:web:0e42b3dda796674ead20dc',
    measurementId: 'G-SQ0WM6S28T',
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

class HeaderTransitionManager {
    constructor() {

        this.headerContainer      = document.getElementById('header-container');
        this.currentHeaderType    = null;   // 'apikey' | 'app' | 'permission'
        this.apiKeyHeader         = null;
        this.appHeader            = null;
        this.permissionSetup      = null;

        /**
         * only one header window is allowed
         * @param {'apikey'|'app'|'permission'} type
         */
        this.ensureHeader = (type) => {
            if (this.currentHeaderType === type) return;

            this.headerContainer.innerHTML = '';
            
            this.apiKeyHeader = null;
            this.appHeader = null;
            this.permissionSetup = null;

            // Create new header element
            if (type === 'apikey') {
                this.apiKeyHeader = document.createElement('apikey-header');
                this.headerContainer.appendChild(this.apiKeyHeader);
            } else if (type === 'permission') {
                this.permissionSetup = document.createElement('permission-setup');
                this.permissionSetup.continueCallback = () => this.transitionToAppHeader();
                this.headerContainer.appendChild(this.permissionSetup);
            } else {
                this.appHeader = document.createElement('app-header');
                this.headerContainer.appendChild(this.appHeader);
                this.appHeader.startSlideInAnimation?.();
            }

            this.currentHeaderType = type;
            this.notifyHeaderState(type === 'permission' ? 'apikey' : type); // Keep permission state as apikey for compatibility
        };

        console.log('[HeaderController] Manager initialized');

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer
                .invoke('get-current-api-key')
                .then(storedKey => {
                    this.hasApiKey = !!storedKey;
                })
                .catch(() => {});
        }

        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            ipcRenderer.on('login-successful', async (event, payload) => {
                const { customToken, token, error } = payload || {};
                try {
                    if (customToken) {
                        console.log('[HeaderController] Received custom token, signing in with custom token...');
                        await signInWithCustomToken(auth, customToken);
                        return;
                    }

                    if (token) {
                        console.log('[HeaderController] Received ID token, attempting Google credential sign-in...');
                        const credential = GoogleAuthProvider.credential(token);
                        await signInWithCredential(auth, credential);
                        return;
                    }

                    if (error) {
                        console.warn('[HeaderController] Login payload indicates verification failure. Showing permission setup.');
                        // Show permission setup after login error
                        this.transitionToPermissionSetup();
                    }
                } catch (error) {
                    console.error('[HeaderController] Sign-in failed', error);
                    // Show permission setup after sign-in failure
                    this.transitionToPermissionSetup();
                }
            });
            
            
            ipcRenderer.on('request-firebase-logout', async () => {
                console.log('[HeaderController] Received request to sign out.');
                try {
                    this.hasApiKey = false;
                    await signOut(auth);
                } catch (error) {
                    console.error('[HeaderController] Sign out failed', error);
                }
            });

            ipcRenderer.on('api-key-validated', () => {
                this.hasApiKey = true;
                // Wait for animation to complete before transitioning
                setTimeout(() => {
                    this.transitionToPermissionSetup();
                }, 350); // Give time for slide-out animation to complete
            });

            ipcRenderer.on('api-key-removed', () => {
                this.hasApiKey = false;
                this.transitionToApiKeyHeader();
            });

            ipcRenderer.on('api-key-updated', () => {
                this.hasApiKey = true;
                if (!auth.currentUser) {
                    this.transitionToPermissionSetup();
                }
            });

            ipcRenderer.on('firebase-auth-success', async (event, firebaseUser) => {
                console.log('[HeaderController] Received firebase-auth-success:', firebaseUser.uid);
                try {
                    if (firebaseUser.idToken) {
                        const credential = GoogleAuthProvider.credential(firebaseUser.idToken);
                        await signInWithCredential(auth, credential);
                        console.log('[HeaderController] Firebase sign-in successful via ID token');
                    } else {
                        console.warn('[HeaderController] No ID token received from deeplink, showing permission setup');
                        // Show permission setup after Firebase auth
                        this.transitionToPermissionSetup();
                    }
                } catch (error) {
                    console.error('[HeaderController] Firebase auth failed:', error);
                    this.transitionToPermissionSetup();
                }
            });
        }

        this._bootstrap();

        onAuthStateChanged(auth, async user => {
            console.log('[HeaderController] Auth state changed. User:', user ? user.email : 'null');

            if (window.require) {
                const { ipcRenderer } = window.require('electron');

                let userDataWithToken = null;
                if (user) {
                    try {
                        const idToken = await user.getIdToken();
                        userDataWithToken = {
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName,
                            photoURL: user.photoURL,
                            idToken: idToken,
                        };
                    } catch (error) {
                        console.error('[HeaderController] Failed to get ID token:', error);
                        userDataWithToken = {
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName,
                            photoURL: user.photoURL,
                            idToken: null,
                        };
                    }
                }

                ipcRenderer.invoke('firebase-auth-state-changed', userDataWithToken).catch(console.error);
            }

            if (!this.isInitialized) {
                this.isInitialized = true;
                return; // Skip on initial load - bootstrap handles it
            }

            // Only handle state changes after initial load
            if (user) {
                console.log('[HeaderController] User logged in, updating hasApiKey and checking permissions...');
                this.hasApiKey = true; // User login should provide API key
                // Delay permission check to ensure smooth login flow
                setTimeout(() => this.transitionToPermissionSetup(), 500);
            } else if (this.hasApiKey) {
                console.log('[HeaderController] No Firebase user but API key exists, checking if permission setup is needed...');
                setTimeout(() => this.transitionToPermissionSetup(), 500);
            } else {
                console.log('[HeaderController] No auth & no API key — showing ApiKeyHeader');
                this.transitionToApiKeyHeader();
            }
        });
    }

    notifyHeaderState(stateOverride) {
        const state = stateOverride || this.currentHeaderType || 'apikey';
        if (window.require) {
            window.require('electron').ipcRenderer.send('header-state-changed', state);
        }
    }

    async _bootstrap() {
        let storedKey = null;
        if (window.require) {
            try {
                storedKey = await window
                    .require('electron')
                    .ipcRenderer.invoke('get-current-api-key');
            } catch (_) {}
        }
        this.hasApiKey = !!storedKey;

        const user = await new Promise(resolve => {
            const unsubscribe = onAuthStateChanged(auth, u => {
                unsubscribe();
                resolve(u);
            });
        });

        // check flow order: API key -> Permissions -> App
        if (!user && !this.hasApiKey) {
            // No auth and no API key -> show API key input
            await this._resizeForApiKey();
            this.ensureHeader('apikey');
        } else {
            // Has API key or user -> check permissions first
            const permissionResult = await this.checkPermissions();
            if (permissionResult.success) {
                // All permissions granted -> go to app
                await this._resizeForApp();
                this.ensureHeader('app');
            } else {
                // Permissions needed -> show permission setup
                await this._resizeForPermissionSetup();
                this.ensureHeader('permission');
            }
        }
    }

    async transitionToPermissionSetup() {
        // Prevent duplicate transitions
        if (this.currentHeaderType === 'permission') {
            console.log('[HeaderController] Already showing permission setup, skipping transition');
            return;
        }

        // Check if permissions were previously completed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                const permissionsCompleted = await ipcRenderer.invoke('check-permissions-completed');
                if (permissionsCompleted) {
                    console.log('[HeaderController] Permissions were previously completed, checking current status...');
                    
                    // Double check current permission status
                    const permissionResult = await this.checkPermissions();
                    if (permissionResult.success) {
                        // Skip permission setup if already granted
                        this.transitionToAppHeader();
                        return;
                    }
                    
                    console.log('[HeaderController] Permissions were revoked, showing setup again');
                }
            } catch (error) {
                console.error('[HeaderController] Error checking permissions completed status:', error);
            }
        }

        await this._resizeForPermissionSetup();
        this.ensureHeader('permission');
    }

    async transitionToAppHeader(animate = true) {
        if (this.currentHeaderType === 'app') {
            return this._resizeForApp();
        }

        const canAnimate =
            animate &&
            (this.apiKeyHeader || this.permissionSetup) &&
            this.currentHeaderType !== 'app';
    
        if (canAnimate && this.apiKeyHeader?.startSlideOutAnimation) {
            const old = this.apiKeyHeader;
            const onEnd = () => {
                clearTimeout(fallback);
                this._resizeForApp().then(() => this.ensureHeader('app'));
            };
            old.addEventListener('animationend', onEnd, { once: true });
            old.startSlideOutAnimation();
    
            const fallback = setTimeout(onEnd, 450);
        } else {
            this.ensureHeader('app');
            this._resizeForApp();
        }
    }

    _resizeForApp() {
        if (!window.require) return;
        return window
            .require('electron')
            .ipcRenderer.invoke('resize-header-window', { width: 353, height: 60 })
            .catch(() => {});
    }

    async _resizeForApiKey() {
        if (!window.require) return;
        return window
            .require('electron')
            .ipcRenderer.invoke('resize-header-window', { width: 285, height: 300 })
            .catch(() => {});
    }

    async _resizeForPermissionSetup() {
        if (!window.require) return;
        return window
            .require('electron')
            .ipcRenderer.invoke('resize-header-window', { width: 285, height: 220 })
            .catch(() => {});
    }

    async transitionToApiKeyHeader() {
        await this._resizeForApiKey();
        
        if (this.currentHeaderType !== 'apikey') {
            this.ensureHeader('apikey');
        }
        
        if (this.apiKeyHeader) this.apiKeyHeader.reset();
    }

    async checkPermissions() {
        if (!window.require) {
            return { success: true };
        }

        const { ipcRenderer } = window.require('electron');
        
        try {
            // Check permission status
            const permissions = await ipcRenderer.invoke('check-system-permissions');
            console.log('[HeaderController] Current permissions:', permissions);
            
            if (!permissions.needsSetup) {
                return { success: true };
            }

            // If permissions are not set up, return false
            let errorMessage = '';
            if (!permissions.microphone && !permissions.screen) {
                errorMessage = 'Microphone and screen recording access required';
            }
            
            return { 
                success: false, 
                error: errorMessage
            };
        } catch (error) {
            console.error('[HeaderController] Error checking permissions:', error);
            return { 
                success: false, 
                error: 'Failed to check permissions' 
            };
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new HeaderTransitionManager();
});
