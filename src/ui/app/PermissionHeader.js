import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

export class PermissionHeader extends LitElement {
    static styles = css`
        :host {
            display: block;
            transition: opacity 0.3s ease-in, transform 0.3s ease-in;
            will-change: opacity, transform;
        }

        :host(.sliding-out) {
            opacity: 0;
            transform: translateY(-20px);
        }

        :host(.hidden) {
            opacity: 0;
            pointer-events: none;
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
            box-sizing: border-box;
        }

        .container {
            -webkit-app-region: drag;
            width: 285px;
            /* height is now set dynamically */
            padding: 18px 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 16px;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 16px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.5) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .close-button {
            -webkit-app-region: no-drag;
            position: absolute;
            top: 10px;
            right: 10px;
            width: 14px;
            height: 14px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 3px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            z-index: 10;
            font-size: 14px;
            line-height: 1;
            padding: 0;
        }

        .close-button:hover {
            background: rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
        }

        .close-button:active {
            transform: scale(0.95);
        }

        .title {
            color: white;
            font-size: 16px;
            font-weight: 500;
            margin: 0;
            text-align: center;
            flex-shrink: 0;
        }

        .form-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            margin-top: auto;
        }

        .form-content.all-granted {
            flex-grow: 1;
            justify-content: center;
            margin-top: 0;
        }

        .subtitle {
            color: rgba(255, 255, 255, 0.7);
            font-size: 11px;
            font-weight: 400;
            text-align: center;
            margin-bottom: 12px;
            line-height: 1.3;
        }

        .permission-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 12px;
            min-height: 20px;
        }

        .permission-item {
            display: flex;
            align-items: center;
            gap: 6px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 11px;
            font-weight: 400;
        }

        .permission-item.granted {
            color: rgba(34, 197, 94, 0.9);
        }

        .permission-icon {
            width: 12px;
            height: 12px;
            opacity: 0.8;
        }

        .check-icon {
            width: 12px;
            height: 12px;
            color: rgba(34, 197, 94, 0.9);
        }

        .action-button {
            -webkit-app-region: no-drag;
            width: 100%;
            height: 34px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease;
            position: relative;
            overflow: hidden;
            margin-bottom: 6px;
        }

        .action-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 10px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.5) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .action-button:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.3);
        }

        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .continue-button {
            -webkit-app-region: no-drag;
            width: 100%;
            height: 34px;
            background: rgba(34, 197, 94, 0.8);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease;
            position: relative;
            overflow: hidden;
            margin-top: 4px;
        }

        .continue-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 10px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.5) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .continue-button:hover:not(:disabled) {
            background: rgba(34, 197, 94, 0.9);
        }

        .continue-button:disabled {
            background: rgba(255, 255, 255, 0.2);
            cursor: not-allowed;
        }
        
        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .container,
        :host-context(body.has-glass) .action-button,
        :host-context(body.has-glass) .continue-button,
        :host-context(body.has-glass) .close-button {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .container::after,
        :host-context(body.has-glass) .action-button::after,
        :host-context(body.has-glass) .continue-button::after {
            display: none !important;
        }

        :host-context(body.has-glass) .action-button:hover,
        :host-context(body.has-glass) .continue-button:hover,
        :host-context(body.has-glass) .close-button:hover {
            background: transparent !important;
        }
    `;

    static properties = {
        microphoneGranted: { type: String },
        screenGranted: { type: String },
        keychainGranted: { type: String },
        isChecking: { type: String },
        continueCallback: { type: Function },
        userMode: { type: String }, // 'local' or 'firebase'
    };

    constructor() {
        super();
        this.microphoneGranted = 'unknown';
        this.screenGranted = 'unknown';
        this.keychainGranted = 'unknown';
        this.isChecking = false;
        this.continueCallback = null;
        this.userMode = 'local'; // Default to local
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('userMode')) {
            const newHeight = this.userMode === 'firebase' ? 280 : 220;
            console.log(`[PermissionHeader] User mode changed to ${this.userMode}, requesting resize to ${newHeight}px`);
            this.dispatchEvent(new CustomEvent('request-resize', {
                detail: { height: newHeight },
                bubbles: true,
                composed: true
            }));
        }
    }

    async connectedCallback() {
        super.connectedCallback();

        if (window.api) {
            try {
                const userState = await window.api.common.getCurrentUser();
                this.userMode = userState.mode;
            } catch (e) {
                console.error('[PermissionHeader] Failed to get user state', e);
                this.userMode = 'local'; // Fallback to local
            }
        }

        await this.checkPermissions();
        
        // Set up periodic permission check
        this.permissionCheckInterval = setInterval(async () => {
            if (window.api) {
                try {
                    const userState = await window.api.common.getCurrentUser();
                    this.userMode = userState.mode;
                } catch (e) {
                    this.userMode = 'local';
                }
            }
            this.checkPermissions();
        }, 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.permissionCheckInterval) {
            clearInterval(this.permissionCheckInterval);
        }
    }

    async checkPermissions() {
        if (!window.api || this.isChecking) return;
        
        this.isChecking = true;
        
        try {
            const permissions = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Permission check result:', permissions);
            
            const prevMic = this.microphoneGranted;
            const prevScreen = this.screenGranted;
            const prevKeychain = this.keychainGranted;
            
            this.microphoneGranted = permissions.microphone;
            this.screenGranted = permissions.screen;
            this.keychainGranted = permissions.keychain;
            
            // if permissions changed == UI update
            if (prevMic !== this.microphoneGranted || prevScreen !== this.screenGranted || prevKeychain !== this.keychainGranted) {
                console.log('[PermissionHeader] Permission status changed, updating UI');
                this.requestUpdate();
            }

            const isKeychainRequired = this.userMode === 'firebase';
            const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';
            
            // if all permissions granted == automatically continue
            if (this.microphoneGranted === 'granted' && 
                this.screenGranted === 'granted' && 
                keychainOk && 
                this.continueCallback) {
                console.log('[PermissionHeader] All permissions granted, proceeding automatically');
                setTimeout(() => this.handleContinue(), 500);
            }
        } catch (error) {
            console.error('[PermissionHeader] Error checking permissions:', error);
        } finally {
            this.isChecking = false;
        }
    }

    async handleMicrophoneClick() {
        if (!window.api || this.microphoneGranted === 'granted') return;
        
        console.log('[PermissionHeader] Requesting microphone permission...');
        
        try {
            const result = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Microphone permission result:', result);
            
            if (result.microphone === 'granted') {
                this.microphoneGranted = 'granted';
                this.requestUpdate();
                return;
              }
            
              if (result.microphone === 'not-determined' || result.microphone === 'denied' || result.microphone === 'unknown' || result.microphone === 'restricted') {
                const res = await window.api.permissionHeader.requestMicrophonePermission();
                if (res.status === 'granted' || res.success === true) {
                    this.microphoneGranted = 'granted';
                    this.requestUpdate();
                    return;
                }
              }
            
            
            // Check permissions again after a delay
            // setTimeout(() => this.checkPermissions(), 1000);
        } catch (error) {
            console.error('[PermissionHeader] Error requesting microphone permission:', error);
        }
    }

    async handleScreenClick() {
        if (!window.api || this.screenGranted === 'granted') return;
        
        console.log('[PermissionHeader] Checking screen recording permission...');
        
        try {
            const permissions = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Screen permission check result:', permissions);
            
            if (permissions.screen === 'granted') {
                this.screenGranted = 'granted';
                this.requestUpdate();
                return;
            }
            if (permissions.screen === 'not-determined' || permissions.screen === 'denied' || permissions.screen === 'unknown' || permissions.screen === 'restricted') {
            console.log('[PermissionHeader] Opening screen recording preferences...');
            await window.api.permissionHeader.openSystemPreferences('screen-recording');
            }
            
            // Check permissions again after a delay
            // (This may not execute if app restarts after permission grant)
            // setTimeout(() => this.checkPermissions(), 2000);
        } catch (error) {
            console.error('[PermissionHeader] Error opening screen recording preferences:', error);
        }
    }

    async handleKeychainClick() {
        if (!window.api || this.keychainGranted === 'granted') return;
        
        console.log('[PermissionHeader] Requesting keychain permission...');
        
        try {
            // Trigger initializeKey to prompt for keychain access
            // Assuming encryptionService is accessible or via API
            await window.api.permissionHeader.initializeEncryptionKey(); // New IPC handler needed
            
            // After success, update status
            this.keychainGranted = 'granted';
            this.requestUpdate();
        } catch (error) {
            console.error('[PermissionHeader] Error requesting keychain permission:', error);
        }
    }

    async handleContinue() {
        const isKeychainRequired = this.userMode === 'firebase';
        const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';

        if (this.continueCallback && 
            this.microphoneGranted === 'granted' && 
            this.screenGranted === 'granted' && 
            keychainOk) {
            // Mark permissions as completed
            if (window.api && isKeychainRequired) {
                try {
                    await window.api.permissionHeader.markKeychainCompleted();
                    console.log('[PermissionHeader] Marked keychain as completed');
                } catch (error) {
                    console.error('[PermissionHeader] Error marking keychain as completed:', error);
                }
            }
            
            this.continueCallback();
        }
    }

    handleClose() {
        console.log('Close button clicked');
        if (window.api) {
            window.api.common.quitApplication();
        }
    }

    render() {
        const isKeychainRequired = this.userMode === 'firebase';
        const containerHeight = isKeychainRequired ? 280 : 220;
        const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';
        const allGranted = this.microphoneGranted === 'granted' && this.screenGranted === 'granted' && keychainOk;

        return html`
            <div class="container" style="height: ${containerHeight}px">
                <button class="close-button" @click=${this.handleClose} title="Close application">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
                    </svg>
                </button>
                <h1 class="title">Permission Setup Required</h1>

                <div class="form-content ${allGranted ? 'all-granted' : ''}">
                    ${!allGranted ? html`
                        <div class="subtitle">Grant access to microphone, screen recording${isKeychainRequired ? ' and keychain' : ''} to continue</div>
                        
                        <div class="permission-status">
                            <div class="permission-item ${this.microphoneGranted === 'granted' ? 'granted' : ''}">
                                ${this.microphoneGranted === 'granted' ? html`
                                    <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Microphone ✓</span>
                                ` : html`
                                    <svg class="permission-icon" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Microphone</span>
                                `}
                            </div>
                            
                            <div class="permission-item ${this.screenGranted === 'granted' ? 'granted' : ''}">
                                ${this.screenGranted === 'granted' ? html`
                                    <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Screen ✓</span>
                                ` : html`
                                    <svg class="permission-icon" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Screen Recording</span>
                                `}
                            </div>

                            ${isKeychainRequired ? html`
                                <div class="permission-item ${this.keychainGranted === 'granted' ? 'granted' : ''}">
                                    ${this.keychainGranted === 'granted' ? html`
                                        <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Data Encryption ✓</span>
                                    ` : html`
                                        <svg class="permission-icon" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.744 5.668l-1.649 1.652c-.63.63-1.706.19-1.706-.742V12.18a.75.75 0 00-1.5 0v2.696c0 .932-1.075 1.372-1.706.742l-1.649-1.652A6 6 0 112 8zm-4 0a.75.75 0 00.75-.75A3.75 3.75 0 018.25 4a.75.75 0 000 1.5 2.25 2.25 0 012.25 2.25.75.75 0 00.75.75z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Data Encryption</span>
                                    `}
                                </div>
                            ` : ''}
                        </div>

                        <button 
                            class="action-button" 
                            @click=${this.handleMicrophoneClick}
                            ?disabled=${this.microphoneGranted === 'granted'}
                        >
                            ${this.microphoneGranted === 'granted' ? 'Microphone Access Granted' : 'Grant Microphone Access'}
                        </button>

                        <button 
                            class="action-button" 
                            @click=${this.handleScreenClick}
                            ?disabled=${this.screenGranted === 'granted'}
                        >
                            ${this.screenGranted === 'granted' ? 'Screen Recording Granted' : 'Grant Screen Recording Access'}
                        </button>

                        ${isKeychainRequired ? html`
                            <button 
                                class="action-button" 
                                @click=${this.handleKeychainClick}
                                ?disabled=${this.keychainGranted === 'granted'}
                            >
                                ${this.keychainGranted === 'granted' ? 'Encryption Enabled' : 'Enable Encryption'}
                            </button>
                            <div class="subtitle" style="visibility: ${this.keychainGranted === 'granted' ? 'hidden' : 'visible'}">
                                Stores the key to encrypt your data. Press "<b>Always Allow</b>" to continue.
                            </div>
                        ` : ''}
                    ` : html`
                        <button 
                            class="continue-button" 
                            @click=${this.handleContinue}
                        >
                            Continue to Pickle Glass
                        </button>
                    `}
                </div>
            </div>
        `;
    }
}

customElements.define('permission-setup', PermissionHeader); 