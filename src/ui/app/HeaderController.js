import './MainHeader.js';
import './ApiKeyHeader.js';
import './PermissionHeader.js';
import './WelcomeHeader.js';

class HeaderTransitionManager {
    constructor() {
        this.headerContainer      = document.getElementById('header-container');
        this.currentHeaderType    = null;   // 'welcome' | 'apikey' | 'main' | 'permission'
        this.welcomeHeader        = null;
        this.apiKeyHeader         = null;
        this.mainHeader            = null;
        this.permissionHeader      = null;

        /**
         * only one header window is allowed
         * @param {'welcome'|'apikey'|'main'|'permission'} type
         */
        this.ensureHeader = (type) => {
            console.log('[HeaderController] ensureHeader: Ensuring header of type:', type);
            if (this.currentHeaderType === type) {
                console.log('[HeaderController] ensureHeader: Header of type:', type, 'already exists.');
                return;
            }

            this.headerContainer.innerHTML = '';
            
            this.welcomeHeader = null;
            this.apiKeyHeader = null;
            this.mainHeader = null;
            this.permissionHeader = null;

            // Create new header element
            if (type === 'welcome') {
                this.welcomeHeader = document.createElement('welcome-header');
                this.welcomeHeader.loginCallback = () => this.handleLoginOption();
                this.welcomeHeader.apiKeyCallback = () => this.handleApiKeyOption();
                this.headerContainer.appendChild(this.welcomeHeader);
                console.log('[HeaderController] ensureHeader: Header of type:', type, 'created.');
            } else if (type === 'apikey') {
                this.apiKeyHeader = document.createElement('apikey-header');
                this.apiKeyHeader.stateUpdateCallback = (userState) => this.handleStateUpdate(userState);
                this.apiKeyHeader.backCallback = () => this.transitionToWelcomeHeader();
                this.apiKeyHeader.addEventListener('request-resize', e => {
                    this._resizeForApiKey(e.detail.height); 
                });
                this.headerContainer.appendChild(this.apiKeyHeader);
                console.log('[HeaderController] ensureHeader: Header of type:', type, 'created.');
            } else if (type === 'permission') {
                this.permissionHeader = document.createElement('permission-setup');
                this.permissionHeader.addEventListener('request-resize', e => {
                    this._resizeForPermissionHeader(e.detail.height); 
                });
                this.permissionHeader.continueCallback = async () => {
                    if (window.api && window.api.headerController) {
                        console.log('[HeaderController] Re-initializing model state after permission grant...');
                        await window.api.headerController.reInitializeModelState();
                    }
                    this.transitionToMainHeader();
                };
                this.headerContainer.appendChild(this.permissionHeader);
            } else {
                this.mainHeader = document.createElement('main-header');
                this.headerContainer.appendChild(this.mainHeader);
                this.mainHeader.startSlideInAnimation?.();
            }

            this.currentHeaderType = type;
            this.notifyHeaderState(type === 'permission' ? 'apikey' : type); // Keep permission state as apikey for compatibility
        };

        console.log('[HeaderController] Manager initialized');

        // WelcomeHeader 콜백 메서드들
        this.handleLoginOption = this.handleLoginOption.bind(this);
        this.handleApiKeyOption = this.handleApiKeyOption.bind(this);

        this._bootstrap();

        if (window.api) {
            window.api.headerController.onUserStateChanged((event, userState) => {
                console.log('[HeaderController] Received user state change:', userState);
                this.handleStateUpdate(userState);
            });

            window.api.headerController.onAuthFailed((event, { message }) => {
                console.error('[HeaderController] Received auth failure from main process:', message);
                if (this.apiKeyHeader) {
                    this.apiKeyHeader.errorMessage = 'Authentication failed. Please try again.';
                    this.apiKeyHeader.isLoading = false;
                }
            });
            window.api.headerController.onForceShowApiKeyHeader(async () => {
                console.log('[HeaderController] Received broadcast to show apikey header. Switching now.');
                const isConfigured = await window.api.apiKeyHeader.areProvidersConfigured();
                if (!isConfigured) {
                    await this._resizeForWelcome();
                    this.ensureHeader('welcome');
                } else {
                    await this._resizeForApiKey();
                    this.ensureHeader('apikey');
                }
            });            
        }
    }

    notifyHeaderState(stateOverride) {
        const state = stateOverride || this.currentHeaderType || 'apikey';
        if (window.api) {
            window.api.headerController.sendHeaderStateChanged(state);
        }
    }

    async _bootstrap() {
        // The initial state will be sent by the main process via 'user-state-changed'
        // We just need to request it.
        if (window.api) {
            const userState = await window.api.common.getCurrentUser();
            console.log('[HeaderController] Bootstrapping with initial user state:', userState);
            this.handleStateUpdate(userState);
        } else {
            // Fallback for non-electron environment (testing/web)
            this.ensureHeader('welcome');
        }
    }


    //////// after_modelStateService ////////
    async handleStateUpdate(userState) {
        const isConfigured = await window.api.apiKeyHeader.areProvidersConfigured();

        if (isConfigured) {
            // If providers are configured, always check permissions regardless of login state.
            const permissionResult = await this.checkPermissions();
            if (permissionResult.success) {
                this.transitionToMainHeader();
            } else {
                this.transitionToPermissionHeader();
            }
        } else {
            // If no providers are configured, show the welcome header to prompt for setup.
            await this._resizeForWelcome();
            this.ensureHeader('welcome');
        }
    }

    // WelcomeHeader 콜백 메서드들
    async handleLoginOption() {
        console.log('[HeaderController] Login option selected');
        if (window.api) {
            await window.api.common.startFirebaseAuth();
        }
    }

    async handleApiKeyOption() {
        console.log('[HeaderController] API key option selected');
        await this._resizeForApiKey(400);
        this.ensureHeader('apikey');
        // ApiKeyHeader에 뒤로가기 콜백 설정
        if (this.apiKeyHeader) {
            this.apiKeyHeader.backCallback = () => this.transitionToWelcomeHeader();
        }
    }

    async transitionToWelcomeHeader() {
        if (this.currentHeaderType === 'welcome') {
            return this._resizeForWelcome();
        }

        await this._resizeForWelcome();
        this.ensureHeader('welcome');
    }
    //////// after_modelStateService ////////

    async transitionToPermissionHeader() {
        // Prevent duplicate transitions
        if (this.currentHeaderType === 'permission') {
            console.log('[HeaderController] Already showing permission setup, skipping transition');
            return;
        }

        // Check if permissions were previously completed
        if (window.api) {
            try {
                const permissionsCompleted = await window.api.headerController.checkPermissionsCompleted();
                if (permissionsCompleted) {
                    console.log('[HeaderController] Permissions were previously completed, checking current status...');
                    
                    // Double check current permission status
                    const permissionResult = await this.checkPermissions();
                    if (permissionResult.success) {
                        // Skip permission setup if already granted
                        this.transitionToMainHeader();
                        return;
                    }
                    
                    console.log('[HeaderController] Permissions were revoked, showing setup again');
                }
            } catch (error) {
                console.error('[HeaderController] Error checking permissions completed status:', error);
            }
        }

        let initialHeight = 220;
        if (window.api) {
            try {
                const userState = await window.api.common.getCurrentUser();
                if (userState.mode === 'firebase') {
                    initialHeight = 280;
                }
            } catch (e) {
                console.error('Could not get user state for resize', e);
            }
        }

        await this._resizeForPermissionHeader(initialHeight);
        this.ensureHeader('permission');
    }

    async transitionToMainHeader(animate = true) {
        if (this.currentHeaderType === 'main') {
            return this._resizeForMain();
        }

        await this._resizeForMain();
        this.ensureHeader('main');
    }

    async _resizeForMain() {
        if (!window.api) return;
        console.log('[HeaderController] _resizeForMain: Resizing window to 353x47');
        return window.api.headerController.resizeHeaderWindow({ width: 353, height: 47 }).catch(() => {});
    }

    async _resizeForApiKey(height = 370) {
        if (!window.api) return;
        console.log(`[HeaderController] _resizeForApiKey: Resizing window to 456x${height}`);
        return window.api.headerController.resizeHeaderWindow({ width: 456, height: height }).catch(() => {});
    }

    async _resizeForPermissionHeader(height) {
        if (!window.api) return;
        const finalHeight = height || 220;
        return window.api.headerController.resizeHeaderWindow({ width: 285, height: finalHeight })
            .catch(() => {});
    }

    async _resizeForWelcome() {
        if (!window.api) return;
        console.log('[HeaderController] _resizeForWelcome: Resizing window to 456x370');
        return window.api.headerController.resizeHeaderWindow({ width: 456, height: 364 })
            .catch(() => {});
    }

    async checkPermissions() {
        if (!window.api) {
            return { success: true };
        }
        
        try {
            const permissions = await window.api.headerController.checkSystemPermissions();
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
