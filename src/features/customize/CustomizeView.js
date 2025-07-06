import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class CustomizeView extends LitElement {
    static styles = css`
        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 180px;
            height: 100%;
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
            // border: 1px solid rgba(255, 255, 255, 0.2);
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
        }
        :host-context(body.has-glass) .settings-container,
        :host-context(body.has-glass) .settings-button,
        :host-context(body.has-glass) .cmd-key,
        :host-context(body.has-glass) .shortcut-key,
        :host-context(body.has-glass) .api-key-section input {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        /* 블러·그림자·gradient 레이어 제거 */
        :host-context(body.has-glass) .settings-container::before {
            display: none !important;
        }

        /* hover/active 시 다시 생기는 배경도 차단 */
        :host-context(body.has-glass) .settings-button:hover,
        :host-context(body.has-glass) .shortcut-item:hover,
        :host-context(body.has-glass) .settings-button.danger:hover {
            background: transparent !important;
            border-color: transparent !important;
            transform: none !important;
        }

        /* 스크롤바 트랙·썸 투명화(선택 사항) */
        :host-context(body.has-glass) .settings-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .settings-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }

    `;

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        throttleTokens: { type: Number },
        maxTokens: { type: Number },
        throttlePercent: { type: Number },
        googleSearchEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onScreenshotIntervalChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
        contentProtection: { type: Boolean },
        userPresets: { type: Array },
        presetTemplates: { type: Array },
        currentUser: { type: String },
        isContentProtectionOn: { type: Boolean },
        firebaseUser: { type: Object, state: true },
        apiKey: { type: String, state: true },
        isLoading: { type: Boolean },
        activeTab: { type: String },
    };

    constructor() {
        super();

        this.selectedProfile = localStorage.getItem('selectedProfile') || 'school';
        
        // Language format migration for legacy users
        let lang = localStorage.getItem('selectedLanguage') || 'en';
        if (lang.includes('-')) {
            const newLang = lang.split('-')[0];
            console.warn(`[Migration] Correcting language format from "${lang}" to "${newLang}".`);
            localStorage.setItem('selectedLanguage', newLang);
            lang = newLang;
        }
        this.selectedLanguage = lang;

        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5000';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || '0.8';
        this.layoutMode = localStorage.getItem('layoutMode') || 'stacked';
        this.keybinds = this.getDefaultKeybinds();
        this.throttleTokens = 500;
        this.maxTokens = 2000;
        this.throttlePercent = 80;
        this.backgroundTransparency = 0.5;
        this.fontSize = 14;
        this.userPresets = [];
        this.presetTemplates = [];
        this.currentUser = 'default_user';
        this.firebaseUser = null;
        this.apiKey = null;
        this.isContentProtectionOn = true;
        this.isLoading = false;
        this.activeTab = 'prompts';

        this.loadKeybinds();
        this.loadRateLimitSettings();
        this.loadGoogleSearchSettings();
        this.loadBackgroundTransparency();
        this.loadFontSize();
        this.loadContentProtectionSettings();
        this.checkContentProtectionStatus();
        this.getApiKeyFromStorage();
    }

    connectedCallback() {
        super.connectedCallback();
        
        this.loadLayoutMode();
        this.loadInitialData();

        this.resizeHandler = () => {
            this.requestUpdate();
            this.updateScrollHeight();
        };
        window.addEventListener('resize', this.resizeHandler);

        setTimeout(() => this.updateScrollHeight(), 100);

        this.addEventListener('mouseenter', () => {
            if (window.require) {
                window.require('electron').ipcRenderer.send('cancel-hide-window', 'settings');
            }
        });

        this.addEventListener('mouseleave', () => {
            if (window.require) {
                window.require('electron').ipcRenderer.send('hide-window', 'settings');
            }
        });

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            this._userStateListener = (event, userState) => {
                console.log('[CustomizeView] Received user-state-changed:', userState);
                if (userState && userState.isLoggedIn) {
                    this.firebaseUser = userState;
                } else {
                    this.firebaseUser = null;
                }
                this.getApiKeyFromStorage(); // Also update API key display
                this.requestUpdate();
            };
            ipcRenderer.on('user-state-changed', this._userStateListener);

            ipcRenderer.on('api-key-validated', (event, newApiKey) => {
                console.log('[CustomizeView] Received api-key-validated, updating state.');
                this.apiKey = newApiKey;
                this.requestUpdate();
            });
            
            ipcRenderer.on('api-key-updated', () => {
                console.log('[CustomizeView] Received api-key-updated, refreshing state.');
                this.getApiKeyFromStorage();
            });
            
            ipcRenderer.on('api-key-removed', () => {
                console.log('[CustomizeView] Received api-key-removed, clearing state.');
                this.apiKey = null;
                this.requestUpdate();
            });

            this.loadInitialUser();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this._userStateListener) {
                ipcRenderer.removeListener('user-state-changed', this._userStateListener);
            }
            ipcRenderer.removeAllListeners('api-key-validated');
            ipcRenderer.removeAllListeners('api-key-updated');
            ipcRenderer.removeAllListeners('api-key-removed');
        }
    }

    updateScrollHeight() {
        const windowHeight = window.innerHeight;
        const maxHeight = windowHeight;
        
        this.style.maxHeight = `${maxHeight}px`;
    }

    async checkContentProtectionStatus() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            this.isContentProtectionOn = await ipcRenderer.invoke('get-content-protection-status');
            this.requestUpdate();
        }
    }

    getProfiles() {
        if (this.presetTemplates && this.presetTemplates.length > 0) {
            return this.presetTemplates.map(t => ({
                value: t.id || t._id,
                name: t.title,
                description: t.prompt?.slice(0, 60) + '...',
            }));
        }

        return [
            { value: 'school', name: 'School', description: '' },
            { value: 'meetings', name: 'Meetings', description: '' },
            { value: 'sales', name: 'Sales', description: '' },
            { value: 'recruiting', name: 'Recruiting', description: '' },
            { value: 'customer-support', name: 'Customer Support', description: '' },
        ];
    }

    getLanguages() {
        return [
            { value: 'en', name: 'English' },
            { value: 'de', name: 'German' },
            { value: 'es', name: 'Spanish' },
            { value: 'fr', name: 'French' },
            { value: 'hi', name: 'Hindi' },
            { value: 'pt', name: 'Portuguese' },
            { value: 'ar', name: 'Arabic' },
            { value: 'id', name: 'Indonesian' },
            { value: 'it', name: 'Italian' },
            { value: 'ja', name: 'Japanese' },
            { value: 'tr', name: 'Turkish' },
            { value: 'vi', name: 'Vietnamese' },
            { value: 'bn', name: 'Bengali' },
            { value: 'gu', name: 'Gujarati' },
            { value: 'kn', name: 'Kannada' },
            { value: 'ml', name: 'Malayalam' },
            { value: 'mr', name: 'Marathi' },
            { value: 'ta', name: 'Tamil' },
            { value: 'te', name: 'Telugu' },
            { value: 'nl', name: 'Dutch' },
            { value: 'ko', name: 'Korean' },
            { value: 'zh', name: 'Chinese' },
            { value: 'pl', name: 'Polish' },
            { value: 'ru', name: 'Russian' },
            { value: 'th', name: 'Thai' },
        ];
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
        };
    }

    handleProfileSelect(e) {
        this.selectedProfile = e.target.value;
        localStorage.setItem('selectedProfile', this.selectedProfile);
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = e.target.value;
        localStorage.setItem('selectedLanguage', this.selectedLanguage);
        this.onLanguageChange(this.selectedLanguage);
    }

    handleScreenshotIntervalSelect(e) {
        this.selectedScreenshotInterval = e.target.value;
        localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        this.onScreenshotIntervalChange(this.selectedScreenshotInterval);
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(e.target.value);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        localStorage.setItem('layoutMode', this.layoutMode);
        this.onLayoutModeChange(e.target.value);
    }

    getUserCustomPrompt() {
        console.log('[CustomizeView] getUserCustomPrompt called');
        console.log('[CustomizeView] userPresets:', this.userPresets);
        console.log('[CustomizeView] selectedProfile:', this.selectedProfile);
        
        if (!this.userPresets || this.userPresets.length === 0) {
            console.log('[CustomizeView] No presets - returning loading message');
            return 'Loading personalized prompt... Please set it in the web.';
        }
        
        let preset = this.userPresets.find(p => p.id === 'personalized' || p._id === 'personalized');
        console.log('[CustomizeView] personalized preset:', preset);
        
        if (!preset) {
            preset = this.userPresets.find(p => p.id === this.selectedProfile || p._id === this.selectedProfile);
            console.log('[CustomizeView] selectedProfile preset:', preset);
        }
        
        if (!preset) {
            preset = this.userPresets[0];
            console.log('[CustomizeView] Using first preset:', preset);
        }
        
        const result = preset?.prompt || 'No personalized prompt set.';
        console.log('[CustomizeView] Final returned prompt:', result);
        return result;
    }

    async loadInitialData() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                this.isLoading = true;
                this.userPresets = await ipcRenderer.invoke('get-user-presets');
                this.presetTemplates = await ipcRenderer.invoke('get-preset-templates');
                console.log('[CustomizeView] Loaded presets and templates via IPC');
            } catch (error) {
                console.error('[CustomizeView] Failed to load data via IPC:', error);
            } finally {
                this.isLoading = false;
            }
        } else {
            console.log('[CustomizeView] IPC not available');
        }
    }

    getDefaultKeybinds() {
        const isMac = window.pickleGlass?.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Cmd+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Cmd+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Cmd+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Cmd+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            manualScreenshot: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    saveKeybinds() {
        localStorage.setItem('customKeybinds', JSON.stringify(this.keybinds));
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        localStorage.removeItem('customKeybinds');
        this.requestUpdate();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: 'Move Window Up',
                description: 'Move the application window up',
            },
            {
                key: 'moveDown',
                name: 'Move Window Down',
                description: 'Move the application window down',
            },
            {
                key: 'moveLeft',
                name: 'Move Window Left',
                description: 'Move the application window left',
            },
            {
                key: 'moveRight',
                name: 'Move Window Right',
                description: 'Move the application window right',
            },
            {
                key: 'toggleVisibility',
                name: 'Toggle Window Visibility',
                description: 'Show/hide the application window',
            },
            {
                key: 'toggleClickThrough',
                name: 'Toggle Click-through Mode',
                description: 'Enable/disable click-through functionality',
            },
            {
                key: 'nextStep',
                name: 'Ask Next Step',
                description: 'Ask AI for the next step suggestion',
            },
            {
                key: 'manualScreenshot',
                name: 'Manual Screenshot',
                description: 'Take a manual screenshot for AI analysis',
            },
            {
                key: 'previousResponse',
                name: 'Previous Response',
                description: 'Navigate to the previous AI response',
            },
            {
                key: 'nextResponse',
                name: 'Next Response',
                description: 'Navigate to the next AI response',
            },
            {
                key: 'scrollUp',
                name: 'Scroll Response Up',
                description: 'Scroll the AI response content up',
            },
            {
                key: 'scrollDown',
                name: 'Scroll Response Down',
                description: 'Scroll the AI response content down',
            },
        ];
    }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();

        const modifiers = [];
        const keys = [];

        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        let mainKey = e.key;

        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            case 'KeyS':
                if (e.shiftKey) mainKey = 'S';
                break;
            case 'KeyM':
                mainKey = 'M';
                break;
            default:
                if (e.key.length === 1) {
                    mainKey = e.key.toUpperCase();
                }
                break;
        }

        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        const keybind = [...modifiers, mainKey].join('+');

        const action = e.target.dataset.action;

        this.handleKeybindChange(action, keybind);

        e.target.value = keybind;
        e.target.blur();
    }

    loadRateLimitSettings() {
        const throttleTokens = localStorage.getItem('throttleTokens');
        const maxTokens = localStorage.getItem('maxTokens');
        const throttlePercent = localStorage.getItem('throttlePercent');

        if (throttleTokens !== null) {
            this.throttleTokens = parseInt(throttleTokens, 10) || 500;
        }
        if (maxTokens !== null) {
            this.maxTokens = parseInt(maxTokens, 10) || 2000;
        }
        if (throttlePercent !== null) {
            this.throttlePercent = parseInt(throttlePercent, 10) || 80;
        }
    }

    handleThrottleTokensChange(e) {
        this.throttleTokens = parseInt(e.target.value, 10);
        localStorage.setItem('throttleTokens', this.throttleTokens.toString());
        this.requestUpdate();
    }

    handleMaxTokensChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            this.maxTokens = value;
            localStorage.setItem('maxTokens', this.maxTokens.toString());
        }
    }

    handleThrottlePercentChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0 && value <= 100) {
            this.throttlePercent = value;
            localStorage.setItem('throttlePercent', this.throttlePercent.toString());
        }
    }

    resetRateLimitSettings() {
        this.throttleTokens = 500;
        this.maxTokens = 2000;
        this.throttlePercent = 80;

        localStorage.removeItem('throttleTokens');
        localStorage.removeItem('maxTokens');
        localStorage.removeItem('throttlePercent');

        this.requestUpdate();
    }

    loadGoogleSearchSettings() {
        const googleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        if (googleSearchEnabled !== null) {
            this.googleSearchEnabled = googleSearchEnabled === 'true';
        }
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        localStorage.setItem('googleSearchEnabled', this.googleSearchEnabled.toString());

        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }

        this.requestUpdate();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode) {
            this.layoutMode = savedLayoutMode;
        }
    }

    loadBackgroundTransparency() {
        const backgroundTransparency = localStorage.getItem('backgroundTransparency');
        if (backgroundTransparency !== null) {
            this.backgroundTransparency = parseFloat(backgroundTransparency) || 0.5;
        }
        this.updateBackgroundTransparency();
    }

    handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        localStorage.setItem('backgroundTransparency', this.backgroundTransparency.toString());
        this.updateBackgroundTransparency();
        this.requestUpdate();
    }

    updateBackgroundTransparency() {
        const root = document.documentElement;
        root.style.setProperty('--header-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--main-content-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--card-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.05})`);
        root.style.setProperty('--input-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.375})`);
        root.style.setProperty('--input-focus-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--button-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 1.125})`);
        root.style.setProperty('--screen-option-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
        root.style.setProperty('--screen-option-hover-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.75})`);
        root.style.setProperty('--scrollbar-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            this.fontSize = parseInt(fontSize, 10) || 14;
        }
        this.updateFontSize();
    }

    handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        localStorage.setItem('fontSize', this.fontSize.toString());
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        const root = document.documentElement;
        root.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    loadContentProtectionSettings() {
        const contentProtection = localStorage.getItem('contentProtection');
        if (contentProtection !== null) {
            this.contentProtection = contentProtection === 'true';
        }
    }

    async handleContentProtectionChange(e) {
        this.contentProtection = e.target.checked;
        localStorage.setItem('contentProtection', this.contentProtection.toString());

        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-content-protection', this.contentProtection);
            } catch (error) {
                console.error('Failed to notify main process about content protection change:', error);
            }
        }

        this.requestUpdate();
    }

    render() {
        const loggedIn = !!this.firebaseUser;
        console.log('[CustomizeView] render: Rendering component template.');
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

                <div class="api-key-section" style="padding: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <input 
                        type="password" 
                        id="api-key-input"
                        placeholder="Enter API Key" 
                        .value=${this.apiKey || ''}
                        ?disabled=${loggedIn}
                        style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px; font-size: 11px; margin-bottom: 4px;"
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

    getMainShortcuts() {
        return [
            { name: 'Show / Hide', key: '\\' },
            { name: 'Ask Anything', key: '↵' },
            { name: 'Scroll AI Response', key: '↕' }
        ];
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
            const { ipcRenderer, shell } = window.require('electron');
            try {
                const webUrl = await ipcRenderer.invoke('get-web-url');
                shell.openExternal(`${webUrl}/personalize`);
            } catch (error) {
                console.error('Failed to get web URL or open external link:', error);
                shell.openExternal('http://localhost:3000/personalize');
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
                const result = await ipcRenderer.invoke('save-api-key', newApiKey);
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
            await ipcRenderer.invoke('remove-api-key');
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

    async loadInitialUser() {
        if (!window.require) return;
        const { ipcRenderer } = window.require('electron');
        try {
            console.log('[CustomizeView] Loading initial user state...');
            const userState = await ipcRenderer.invoke('get-current-user');
            if (userState && userState.isLoggedIn) {
                this.firebaseUser = userState;
            } else {
                this.firebaseUser = null;
            }
            this.requestUpdate();
        } catch (error) {
            console.error('[CustomizeView] Failed to load initial user:', error);
            this.firebaseUser = null;
            this.requestUpdate();
        }
    }

    getApiKeyFromStorage() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('get-stored-api-key').then(key => {
                this.apiKey = key;
                this.requestUpdate();
            }).catch(error => {
                console.log('[CustomizeView] Failed to get API key:', error);
                this.apiKey = null;
            });
        }
        return null;
    }
}

customElements.define('customize-view', CustomizeView);
