import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

export class PermissionSetup extends LitElement {
    static styles = css`
        :host {
            display: block;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: opacity 0.25s ease-out;
        }

        :host(.sliding-out) {
            animation: slideOutUp 0.3s ease-in forwards;
            will-change: opacity, transform;
        }

        :host(.hidden) {
            opacity: 0;
            pointer-events: none;
        }

        @keyframes slideOutUp {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-20px);
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
            box-sizing: border-box;
        }

        .container {
            width: 285px;
            height: 220px;
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
    `;

    static properties = {
        microphoneGranted: { type: String },
        screenGranted: { type: String },
        isChecking: { type: String },
        continueCallback: { type: Function }
    };

    constructor() {
        super();
        this.microphoneGranted = 'unknown';
        this.screenGranted = 'unknown';
        this.isChecking = false;
        this.continueCallback = null;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.checkPermissions();
        
        // Set up periodic permission check
        this.permissionCheckInterval = setInterval(() => {
            this.checkPermissions();
        }, 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.permissionCheckInterval) {
            clearInterval(this.permissionCheckInterval);
        }
    }

    async handleMouseDown(e) {
        if (e.target.tagName === 'BUTTON') {
            return;
        }

        e.preventDefault();

        const { ipcRenderer } = window.require('electron');
        const initialPosition = await ipcRenderer.invoke('get-header-position');

        this.dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: initialPosition.x,
            initialWindowY: initialPosition.y,
            moved: false,
        };

        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mouseup', this.handleMouseUp, { once: true });
    }

    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = Math.abs(e.screenX - this.dragState.initialMouseX);
        const deltaY = Math.abs(e.screenY - this.dragState.initialMouseY);

        if (deltaX > 3 || deltaY > 3) {
            this.dragState.moved = true;
        }

        const newWindowX = this.dragState.initialWindowX + (e.screenX - this.dragState.initialMouseX);
        const newWindowY = this.dragState.initialWindowY + (e.screenY - this.dragState.initialMouseY);

        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('move-header-to', newWindowX, newWindowY);
    }

    handleMouseUp(e) {
        if (!this.dragState) return;

        const wasDragged = this.dragState.moved;

        window.removeEventListener('mousemove', this.handleMouseMove);
        this.dragState = null;

        if (wasDragged) {
            this.wasJustDragged = true;
            setTimeout(() => {
                this.wasJustDragged = false;
            }, 200);
        }
    }

    async checkPermissions() {
        if (!window.require || this.isChecking) return;
        
        this.isChecking = true;
        const { ipcRenderer } = window.require('electron');
        
        try {
            const permissions = await ipcRenderer.invoke('check-system-permissions');
            console.log('[PermissionSetup] Permission check result:', permissions);
            
            const prevMic = this.microphoneGranted;
            const prevScreen = this.screenGranted;
            
            this.microphoneGranted = permissions.microphone;
            this.screenGranted = permissions.screen;
            
            // if permissions changed == UI update
            if (prevMic !== this.microphoneGranted || prevScreen !== this.screenGranted) {
                console.log('[PermissionSetup] Permission status changed, updating UI');
                this.requestUpdate();
            }
            
            // if all permissions granted == automatically continue
            if (this.microphoneGranted === 'granted' && 
                this.screenGranted === 'granted' && 
                this.continueCallback) {
                console.log('[PermissionSetup] All permissions granted, proceeding automatically');
                setTimeout(() => this.handleContinue(), 500);
            }
        } catch (error) {
            console.error('[PermissionSetup] Error checking permissions:', error);
        } finally {
            this.isChecking = false;
        }
    }

    async handleMicrophoneClick() {
        if (!window.require || this.microphoneGranted === 'granted' || this.wasJustDragged) return;
        
        console.log('[PermissionSetup] Requesting microphone permission...');
        const { ipcRenderer } = window.require('electron');
        
        try {
            const result = await ipcRenderer.invoke('check-system-permissions');
            console.log('[PermissionSetup] Microphone permission result:', result);
            
            if (result.microphone === 'granted') {
                this.microphoneGranted = 'granted';
                this.requestUpdate();
                return;
              }
            
              if (result.microphone === 'not-determined' || result.microphone === 'denied' || result.microphone === 'unknown' || result.microphone === 'restricted') {
                const res = await ipcRenderer.invoke('request-microphone-permission');
                if (res.status === 'granted' || res.success === true) {
                    this.microphoneGranted = 'granted';
                    this.requestUpdate();
                    return;
                }
              }
            
            
            // Check permissions again after a delay
            // setTimeout(() => this.checkPermissions(), 1000);
        } catch (error) {
            console.error('[PermissionSetup] Error requesting microphone permission:', error);
        }
    }

    async handleScreenClick() {
        if (!window.require || this.screenGranted === 'granted' || this.wasJustDragged) return;
        
        console.log('[PermissionSetup] Checking screen recording permission...');
        const { ipcRenderer } = window.require('electron');
        
        try {
            const permissions = await ipcRenderer.invoke('check-system-permissions');
            console.log('[PermissionSetup] Screen permission check result:', permissions);
            
            if (permissions.screen === 'granted') {
                this.screenGranted = 'granted';
                this.requestUpdate();
                return;
            }
            if (permissions.screen === 'not-determined' || permissions.screen === 'denied' || permissions.screen === 'unknown' || permissions.screen === 'restricted') {
            console.log('[PermissionSetup] Opening screen recording preferences...');
            await ipcRenderer.invoke('open-system-preferences', 'screen-recording');
            }
            
            // Check permissions again after a delay
            // (This may not execute if app restarts after permission grant)
            // setTimeout(() => this.checkPermissions(), 2000);
        } catch (error) {
            console.error('[PermissionSetup] Error opening screen recording preferences:', error);
        }
    }

    async handleContinue() {
        if (this.continueCallback && 
            this.microphoneGranted === 'granted' && 
            this.screenGranted === 'granted' && 
            !this.wasJustDragged) {
            // Mark permissions as completed
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                try {
                    await ipcRenderer.invoke('mark-permissions-completed');
                    console.log('[PermissionSetup] Marked permissions as completed');
                } catch (error) {
                    console.error('[PermissionSetup] Error marking permissions as completed:', error);
                }
            }
            
            this.continueCallback();
        }
    }

    handleClose() {
        console.log('Close button clicked');
        if (window.require) {
            window.require('electron').ipcRenderer.invoke('quit-application');
        }
    }

    render() {
        const allGranted = this.microphoneGranted === 'granted' && this.screenGranted === 'granted';

        return html`
            <div class="container" @mousedown=${this.handleMouseDown}>
                <button class="close-button" @click=${this.handleClose} title="Close application">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
                    </svg>
                </button>
                <h1 class="title">Permission Setup Required</h1>

                <div class="form-content">
                    <div class="subtitle">Grant access to microphone and screen recording to continue</div>
                    
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
                    </div>

                    ${this.microphoneGranted !== 'granted' ? html`
                        <button 
                            class="action-button" 
                            @click=${this.handleMicrophoneClick}
                        >
                            Grant Microphone Access
                        </button>
                    ` : ''}

                    ${this.screenGranted !== 'granted' ? html`
                        <button 
                            class="action-button" 
                            @click=${this.handleScreenClick}
                        >
                            Grant Screen Recording Access
                        </button>
                    ` : ''}

                    ${allGranted ? html`
                        <button 
                            class="continue-button" 
                            @click=${this.handleContinue}
                        >
                            Continue to Pickle Glass
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

customElements.define('permission-setup', PermissionSetup); 