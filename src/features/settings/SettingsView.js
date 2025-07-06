import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class SettingsView extends LitElement {
    static styles = css`
        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 180px;
            min-height: 180px;
            color: white;
        }

        .settings-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgba(20, 20, 20, 0.8);
            border-radius: 12px;
            outline: 0.5px rgba(255, 255, 255, 0.2) solid;
            outline-offset: -1px;
            box-sizing: border-box;
            position: relative;
            overflow-y: auto;
            padding: 12px 12px;
            z-index: 1000;
        }

        .settings-container::-webkit-scrollbar {
            width: 6px;
        }

        .settings-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .settings-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .settings-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .settings-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }
            
        .settings-button[disabled],
        .api-key-section input[disabled] {
            opacity: 0.4;
            cursor: not-allowed;
            pointer-events: none;
        }

        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
            z-index: 1;
        }

        .title-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .app-title {
            font-size: 13px;
            font-weight: 500;
            color: white;
            margin: 0 0 4px 0;
        }

        .account-info {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            margin: 0;
        }

        .invisibility-icon {
            padding-top: 2px;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .invisibility-icon.visible {
            opacity: 1;
        }

        .invisibility-icon svg {
            width: 16px;
            height: 16px;
        }

        .shortcuts-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 4px 0;
            position: relative;
            z-index: 1;
        }

        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            color: white;
            font-size: 11px;
        }

        .shortcut-name {
            font-weight: 300;
        }

        .shortcut-keys {
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .cmd-key, .shortcut-key {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
        }

        /* Buttons Section */
        .buttons-section {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
            z-index: 1;
            flex: 1;
        }

        .settings-button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: white;
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 400;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
        }

        .settings-button:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .settings-button:active {
            transform: translateY(1px);
        }

        .settings-button.full-width {
            width: 100%;
        }

        .settings-button.half-width {
            flex: 1;
        }

        .settings-button.danger {
            background: rgba(255, 59, 48, 0.1);
            border-color: rgba(255, 59, 48, 0.3);
            color: rgba(255, 59, 48, 0.9);
        }

        .settings-button.danger:hover {
            background: rgba(255, 59, 48, 0.15);
            border-color: rgba(255, 59, 48, 0.4);
        }

        .move-buttons, .bottom-buttons {
            display: flex;
            gap: 4px;
        }

        .api-key-section {
            padding: 6px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .api-key-section input {
            width: 100%;
            background: rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            border-radius: 4px;
            padding: 4px;
            font-size: 11px;
            margin-bottom: 4px;
            box-sizing: border-box;
        }

        .api-key-section input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        /* Preset Management Section */
        .preset-section {
            padding: 6px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .preset-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .preset-title {
            font-size: 11px;
            font-weight: 500;
            color: white;
        }

        .preset-count {
            font-size: 9px;
            color: rgba(255, 255, 255, 0.5);
            margin-left: 4px;
        }

        .preset-toggle {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 2px;
            transition: background-color 0.15s ease;
        }

        .preset-toggle:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .preset-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 120px;
            overflow-y: auto;
        }

        .preset-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.15s ease;
            font-size: 11px;
            border: 1px solid transparent;
        }

        .preset-item:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .preset-item.selected {
            background: rgba(0, 122, 255, 0.25);
            border-color: rgba(0, 122, 255, 0.6);
            box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.3);
        }

        .preset-name {
            color: white;
            flex: 1;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
            font-weight: 300;
        }

        .preset-item.selected .preset-name {
            font-weight: 500;
        }

        .preset-status {
            font-size: 9px;
            color: rgba(0, 122, 255, 0.8);
            font-weight: 500;
            margin-left: 6px;
        }

        .no-presets-message {
            padding: 12px 8px;
            text-align: center;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
            line-height: 1.4;
        }

        .no-presets-message .web-link {
            color: rgba(0, 122, 255, 0.8);
            text-decoration: underline;
            cursor: pointer;
        }

        .no-presets-message .web-link:hover {
            color: rgba(0, 122, 255, 1);
        }

        .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 11px;
        }

        .loading-spinner {
            width: 12px;
            height: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-top: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 6px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none;
        }
    `;

    static properties = {
        firebaseUser: { type: Object, state: true },
        apiKey: { type: String, state: true },
        isLoading: { type: Boolean, state: true },
        isContentProtectionOn: { type: Boolean, state: true },
        settings: { type: Object, state: true },
        presets: { type: Array, state: true },
        selectedPreset: { type: Object, state: true },
        showPresets: { type: Boolean, state: true },
        saving: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.firebaseUser = null;
        this.apiKey = null;
        this.isLoading = false;
        this.isContentProtectionOn = true;
        this.settings = null;
        this.presets = [];
        this.selectedPreset = null;
        this.showPresets = false;
        this.saving = false;
        this.loadInitialData();
    }

    async loadInitialData() {
        if (!window.require) return;
        
        try {
            this.isLoading = true;
            const { ipcRenderer } = window.require('electron');
            
            // Load all data in parallel
            const [settings, presets, apiKey, contentProtection, userState] = await Promise.all([
                ipcRenderer.invoke('settings:getSettings'),
                ipcRenderer.invoke('settings:getPresets'),
                ipcRenderer.invoke('get-stored-api-key'),
                ipcRenderer.invoke('get-content-protection-status'),
                ipcRenderer.invoke('get-current-user')
            ]);
            
            this.settings = settings;
            this.presets = presets || [];
            this.apiKey = apiKey;
            this.isContentProtectionOn = contentProtection;
            
            // Set first user preset as selected
            if (this.presets.length > 0) {
                const firstUserPreset = this.presets.find(p => p.is_default === 0);
                if (firstUserPreset) {
                    this.selectedPreset = firstUserPreset;
                }
            }
            
            if (userState && userState.isLoggedIn) {
                this.firebaseUser = userState.user;
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            this.isLoading = false;
        }
    }

    connectedCallback() {
        super.connectedCallback();
        
        this.setupEventListeners();
        this.setupIpcListeners();
        this.setupWindowResize();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.cleanupEventListeners();
        this.cleanupIpcListeners();
        this.cleanupWindowResize();
    }

    setupEventListeners() {
        this.addEventListener('mouseenter', this.handleMouseEnter);
        this.addEventListener('mouseleave', this.handleMouseLeave);
    }

    cleanupEventListeners() {
        this.removeEventListener('mouseenter', this.handleMouseEnter);
        this.removeEventListener('mouseleave', this.handleMouseLeave);
    }

    setupIpcListeners() {
        if (!window.require) return;
        
        const { ipcRenderer } = window.require('electron');
        
        this._userStateListener = (event, userState) => {
            console.log('[SettingsView] Received user-state-changed:', userState);
            if (userState && userState.isLoggedIn) {
                this.firebaseUser = userState;
            } else {
                this.firebaseUser = null;
            }
            this.requestUpdate();
        };
        
        this._settingsUpdatedListener = (event, settings) => {
            console.log('[SettingsView] Received settings-updated');
            this.settings = settings;
            this.requestUpdate();
        };

        // 프리셋 업데이트 리스너 추가
        this._presetsUpdatedListener = async (event) => {
            console.log('[SettingsView] Received presets-updated, refreshing presets');
            try {
                const presets = await ipcRenderer.invoke('settings:getPresets');
                this.presets = presets || [];
                
                // 현재 선택된 프리셋이 삭제되었는지 확인 (사용자 프리셋만 고려)
                const userPresets = this.presets.filter(p => p.is_default === 0);
                if (this.selectedPreset && !userPresets.find(p => p.id === this.selectedPreset.id)) {
                    this.selectedPreset = userPresets.length > 0 ? userPresets[0] : null;
                }
                
                this.requestUpdate();
            } catch (error) {
                console.error('[SettingsView] Failed to refresh presets:', error);
            }
        };
        
        ipcRenderer.on('user-state-changed', this._userStateListener);
        ipcRenderer.on('settings-updated', this._settingsUpdatedListener);
        ipcRenderer.on('presets-updated', this._presetsUpdatedListener);
    }

    cleanupIpcListeners() {
        if (!window.require) return;
        
        const { ipcRenderer } = window.require('electron');
        
        if (this._userStateListener) {
            ipcRenderer.removeListener('user-state-changed', this._userStateListener);
        }
        if (this._settingsUpdatedListener) {
            ipcRenderer.removeListener('settings-updated', this._settingsUpdatedListener);
        }
        if (this._presetsUpdatedListener) {
            ipcRenderer.removeListener('presets-updated', this._presetsUpdatedListener);
        }
    }

    setupWindowResize() {
        this.resizeHandler = () => {
            this.requestUpdate();
            this.updateScrollHeight();
        };
        window.addEventListener('resize', this.resizeHandler);
        
        // Initial setup
        setTimeout(() => this.updateScrollHeight(), 100);
    }

    cleanupWindowResize() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }

    updateScrollHeight() {
        const windowHeight = window.innerHeight;
        const headerHeight = 40;
        const padding = 20;
        const maxHeight = windowHeight - headerHeight - padding;
        
        this.style.maxHeight = `${maxHeight}px`;
        
        const container = this.shadowRoot?.querySelector('.settings-container');
        if (container) {
            container.style.maxHeight = `${maxHeight - 20}px`;
        }
    }

    handleMouseEnter = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('cancel-hide-window', 'settings');
        }
    }

    handleMouseLeave = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('hide-window', 'settings');
        }
    }

    getMainShortcuts() {
        return [
            { name: 'Show / Hide', key: '\\' },
            { name: 'Ask Anything', key: '↵' },
            { name: 'Scroll AI Response', key: '↕' }
        ];
    }

    togglePresets() {
        this.showPresets = !this.showPresets;
    }

    async handlePresetSelect(preset) {
        this.selectedPreset = preset;
        // Here you could implement preset application logic
        console.log('Selected preset:', preset);
    }

    handleMoveLeft() {
        console.log('Move Left clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('move-window-step', 'left');
        }
    }

    handleMoveRight() {
        console.log('Move Right clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('move-window-step', 'right');
        }
    }

    async handlePersonalize() {
        console.log('Personalize clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                await ipcRenderer.invoke('open-login-page');
            } catch (error) {
                console.error('Failed to open personalize page:', error);
            }
        }
    }

    async handleToggleInvisibility() {
        console.log('Toggle Invisibility clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            this.isContentProtectionOn = await ipcRenderer.invoke('toggle-content-protection');
            this.requestUpdate();
        }
    }

    async handleSaveApiKey() {
        const input = this.shadowRoot.getElementById('api-key-input');
        if (!input || !input.value) return;

        const newApiKey = input.value;
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                const result = await ipcRenderer.invoke('settings:saveApiKey', newApiKey);
                if (result.success) {
                    console.log('API Key saved successfully via IPC.');
                    this.apiKey = newApiKey;
                    this.requestUpdate();
                } else {
                     console.error('Failed to save API Key via IPC:', result.error);
                }
            } catch(e) {
                console.error('Error invoking save-api-key IPC:', e);
            }
        }
    }

    async handleClearApiKey() {
        console.log('Clear API Key clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('settings:removeApiKey');
            this.apiKey = null;
            this.requestUpdate();
        }
    }

    handleQuit() {
        console.log('Quit clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('quit-application');
        }
    }

    handleFirebaseLogout() {
        console.log('Firebase Logout clicked');
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('firebase-logout');
        }
    }

    render() {
        if (this.isLoading) {
            return html`
                <div class="settings-container">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <span>Loading...</span>
                    </div>
                </div>
            `;
        }

        const loggedIn = !!this.firebaseUser;

        return html`
            <div class="settings-container">
                <div class="header-section">
                    <div>
                        <h1 class="app-title">Pickle Glass</h1>
                        <div class="account-info">
                            ${this.firebaseUser
                                ? html`Account: ${this.firebaseUser.email || 'Logged In'}`
                                : this.apiKey && this.apiKey.length > 10
                                    ? html`API Key: ${this.apiKey.substring(0, 6)}...${this.apiKey.substring(this.apiKey.length - 6)}`
                                    : `Account: Not Logged In`
                            }
                        </div>
                    </div>
                    <div class="invisibility-icon ${this.isContentProtectionOn ? 'visible' : ''}" title="Invisibility is On">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9.785 7.41787C8.7 7.41787 7.79 8.19371 7.55667 9.22621C7.0025 8.98704 6.495 9.05121 6.11 9.22037C5.87083 8.18204 4.96083 7.41787 3.88167 7.41787C2.61583 7.41787 1.58333 8.46204 1.58333 9.75121C1.58333 11.0404 2.61583 12.0845 3.88167 12.0845C5.08333 12.0845 6.06333 11.1395 6.15667 9.93787C6.355 9.79787 6.87417 9.53537 7.51 9.94954C7.615 11.1454 8.58333 12.0845 9.785 12.0845C11.0508 12.0845 12.0833 11.0404 12.0833 9.75121C12.0833 8.46204 11.0508 7.41787 9.785 7.41787ZM3.88167 11.4195C2.97167 11.4195 2.2425 10.6729 2.2425 9.75121C2.2425 8.82954 2.9775 8.08287 3.88167 8.08287C4.79167 8.08287 5.52083 8.82954 5.52083 9.75121C5.52083 10.6729 4.79167 11.4195 3.88167 11.4195ZM9.785 11.4195C8.875 11.4195 8.14583 10.6729 8.14583 9.75121C8.14583 8.82954 8.875 8.08287 9.785 8.08287C10.695 8.08287 11.43 8.82954 11.43 9.75121C11.43 10.6729 10.6892 11.4195 9.785 11.4195ZM12.6667 5.95954H1V6.83454H12.6667V5.95954ZM8.8925 1.36871C8.76417 1.08287 8.4375 0.931207 8.12833 1.03037L6.83333 1.46204L5.5325 1.03037L5.50333 1.02454C5.19417 0.93704 4.8675 1.10037 4.75083 1.39787L3.33333 5.08454H10.3333L8.91 1.39787L8.8925 1.36871Z" fill="white"/>
                        </svg>
                    </div>
                </div>

                <div class="api-key-section">
                    <input 
                        type="password" 
                        id="api-key-input"
                        placeholder="Enter API Key" 
                        .value=${this.apiKey || ''}
                        ?disabled=${loggedIn}
                    >
                    <button class="settings-button full-width" @click=${this.handleSaveApiKey} ?disabled=${loggedIn}>
                        Save API Key
                    </button>
                </div>

                <div class="shortcuts-section">
                    ${this.getMainShortcuts().map(shortcut => html`
                        <div class="shortcut-item">
                            <span class="shortcut-name">${shortcut.name}</span>
                            <div class="shortcut-keys">
                                <span class="cmd-key">⌘</span>
                                <span class="shortcut-key">${shortcut.key}</span>
                            </div>
                        </div>
                    `)}
                </div>

                <!-- Preset Management Section -->
                <div class="preset-section">
                    <div class="preset-header">
                        <span class="preset-title">
                            My Presets
                            <span class="preset-count">(${this.presets.filter(p => p.is_default === 0).length})</span>
                        </span>
                        <span class="preset-toggle" @click=${this.togglePresets}>
                            ${this.showPresets ? '▼' : '▶'}
                        </span>
                    </div>
                    
                    <div class="preset-list ${this.showPresets ? '' : 'hidden'}">
                        ${this.presets.filter(p => p.is_default === 0).length === 0 ? html`
                            <div class="no-presets-message">
                                No custom presets yet.<br>
                                <span class="web-link" @click=${this.handlePersonalize}>
                                    Create your first preset
                                </span>
                            </div>
                        ` : this.presets.filter(p => p.is_default === 0).map(preset => html`
                            <div class="preset-item ${this.selectedPreset?.id === preset.id ? 'selected' : ''}"
                                 @click=${() => this.handlePresetSelect(preset)}>
                                <span class="preset-name">${preset.title}</span>
                                ${this.selectedPreset?.id === preset.id ? html`<span class="preset-status">Selected</span>` : ''}
                            </div>
                        `)}
                    </div>
                </div>

                <div class="buttons-section">
                    <button class="settings-button full-width" @click=${this.handlePersonalize}>
                        <span>Personalize / Meeting Notes</span>
                    </button>
                    
                    <div class="move-buttons">
                        <button class="settings-button half-width" @click=${this.handleMoveLeft}>
                            <span>← Move</span>
                        </button>
                        <button class="settings-button half-width" @click=${this.handleMoveRight}>
                            <span>Move →</span>
                        </button>
                    </div>
                    
                    <button class="settings-button full-width" @click=${this.handleToggleInvisibility}>
                        <span>${this.isContentProtectionOn ? 'Disable Invisibility' : 'Enable Invisibility'}</span>
                    </button>
                    
                    <div class="bottom-buttons">
                        ${this.firebaseUser
                            ? html`
                                <button class="settings-button half-width danger" @click=${this.handleFirebaseLogout}>
                                    <span>Logout</span>
                                </button>
                                `
                            : html`
                                <button class="settings-button half-width danger" @click=${this.handleClearApiKey}>
                                    <span>Clear API Key</span>
                                </button>
                                `
                        }
                        <button class="settings-button half-width danger" @click=${this.handleQuit}>
                            <span>Quit</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('settings-view', SettingsView);