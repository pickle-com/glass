import './AppHeader.js';
import './ApiKeyHeader.js';
import './PermissionSetup.js';

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

        this._bootstrap();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            ipcRenderer.on('user-state-changed', (event, userState) => {
                console.log('[HeaderController] Received user state change:', userState);
                this.handleStateUpdate(userState);
            });

            ipcRenderer.on('auth-failed', (event, { message }) => {
                console.error('[HeaderController] Received auth failure from main process:', message);
                if (this.apiKeyHeader) {
                    this.apiKeyHeader.errorMessage = 'Authentication failed. Please try again.';
                    this.apiKeyHeader.isLoading = false;
                }
            });
        }
    }

    notifyHeaderState(stateOverride) {
        const state = stateOverride || this.currentHeaderType || 'apikey';
        if (window.require) {
            window.require('electron').ipcRenderer.send('header-state-changed', state);
        }
    }

    async _bootstrap() {
        // The initial state will be sent by the main process via 'user-state-changed'
        // We just need to request it.
        if (window.require) {
            const userState = await window.require('electron').ipcRenderer.invoke('get-current-user');
            console.log('[HeaderController] Bootstrapping with initial user state:', userState);
            this.handleStateUpdate(userState);
        } else {
            // Fallback for non-electron environment (testing/web)
            this.ensureHeader('apikey');
        }
    }

    async handleStateUpdate(userState) {
        const { isLoggedIn, hasApiKey } = userState;

        if (isLoggedIn) {
            // Firebase user: Check permissions, then show App or Permission Setup
            const permissionResult = await this.checkPermissions();
            if (permissionResult.success) {
                this.transitionToAppHeader();
            } else {
                this.transitionToPermissionSetup();
            }
        } else if (hasApiKey) {
            // API Key only user: Skip permission check, go directly to App
            this.transitionToAppHeader();
        } else {
            // No auth at all
            await this._resizeForApiKey();
            this.ensureHeader('apikey');
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

        await this._resizeForApp();
        this.ensureHeader('app');
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

    async checkPermissions() {
        if (!window.require) {
            return { success: true };
        }

        const { ipcRenderer } = window.require('electron');
        
        try {
            const permissions = await ipcRenderer.invoke('check-system-permissions');
            console.log('[HeaderController] Current permissions:', permissions);
            
            if (!permissions.needsSetup) {
                return { success: true };
            }

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
