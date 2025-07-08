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
            width: 240px;
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

        .api-key-section, .model-selection-section {
            padding: 8px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .provider-key-group, .model-select-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        label {
            font-size: 11px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.8);
            margin-left: 2px;
        }
        label > strong {
            color: white;
            font-weight: 600;
        }
        .provider-key-group input {
            width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2);
            color: white; border-radius: 4px; padding: 5px 8px; font-size: 11px; box-sizing: border-box;
        }
        .key-buttons { display: flex; gap: 4px; }
        .key-buttons .settings-button { flex: 1; padding: 4px; }
        .model-list {
            display: flex; flex-direction: column; gap: 2px; max-height: 120px;
            overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 4px;
            padding: 4px; margin-top: 4px;
        }
        .model-item { padding: 5px 8px; font-size: 11px; border-radius: 3px; cursor: pointer; transition: background-color 0.15s; }
        .model-item:hover { background-color: rgba(255,255,255,0.1); }
        .model-item.selected { background-color: rgba(0, 122, 255, 0.4); font-weight: 500; }
            
        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            will-change: auto !important;
        }

        :host-context(body.has-glass) * {
            background: transparent !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
            outline: none !important;
            border: none !important;
            border-radius: 0 !important;
            transition: none !important;
            animation: none !important;
        }

        :host-context(body.has-glass) .settings-container::before {
            display: none !important;
        }
    `;


    //////// after_modelStateService ////////
    static properties = {
        shortcuts: { type: Object, state: true },
        firebaseUser: { type: Object, state: true },
        isLoading: { type: Boolean, state: true },
        isContentProtectionOn: { type: Boolean, state: true },
        saving: { type: Boolean, state: true },
        providerConfig: { type: Object, state: true },
        apiKeys: { type: Object, state: true },
        availableLlmModels: { type: Array, state: true },
        availableSttModels: { type: Array, state: true },
        selectedLlm: { type: String, state: true },
        selectedStt: { type: String, state: true },
        isLlmListVisible: { type: Boolean },
        isSttListVisible: { type: Boolean },
        presets: { type: Array, state: true },
        selectedPreset: { type: Object, state: true },
        showPresets: { type: Boolean, state: true },
        autoUpdateEnabled: { type: Boolean, state: true },
        autoUpdateLoading: { type: Boolean, state: true },
    };
    //////// after_modelStateService ////////

    constructor() {
        super();
        //////// after_modelStateService ////////
        this.shortcuts = {};
        this.firebaseUser = null;
        this.apiKeys = { openai: '', gemini: '', anthropic: '' };
        this.providerConfig = {};
        this.isLoading = true;
        this.isContentProtectionOn = true;
        this.saving = false;
        this.availableLlmModels = [];
        this.availableSttModels = [];
        this.selectedLlm = null;
        this.selectedStt = null;
        this.isLlmListVisible = false;
        this.isSttListVisible = false;
        this.presets = [];
        this.selectedPreset = null;
        this.showPresets = false;
        this.handleUsePicklesKey = this.handleUsePicklesKey.bind(this)
        this.autoUpdateEnabled = true;
        this.autoUpdateLoading = true;
        this.loadInitialData();
        //////// after_modelStateService ////////
    }

    async loadAutoUpdateSetting() {
        if (!window.require) return;
        const { ipcRenderer } = window.require('electron');
        this.autoUpdateLoading = true;
        try {
            const enabled = await ipcRenderer.invoke('get-auto-update');
            this.autoUpdateEnabled = enabled;
        } catch (e) {
            this.autoUpdateEnabled = true; // fallback
        }
        this.autoUpdateLoading = false;
        this.requestUpdate();
    }

    async handleToggleAutoUpdate() {
        if (!window.require || this.autoUpdateLoading) return;
        const { ipcRenderer } = window.require('electron');
        this.autoUpdateLoading = true;
        this.requestUpdate();
        try {
            const newValue = !this.autoUpdateEnabled;
            const success = await ipcRenderer.invoke('set-auto-update', newValue);
            if (success) {
                this.autoUpdateEnabled = newValue;
            } else {
                console.error('Failed to update auto-update setting');
            }
        } catch (e) {
            console.error('Error toggling auto-update:', e);
        }
        this.autoUpdateLoading = false;
        this.requestUpdate();
    }

    //////// after_modelStateService ////////
    async loadInitialData() {
        if (!window.require) return;
        this.isLoading = true;
        const { ipcRenderer } = window.require('electron');
        try {
            const [userState, config, storedKeys, availableLlm, availableStt, selectedModels, presets, contentProtection, shortcuts] = await Promise.all([
                ipcRenderer.invoke('get-current-user'),
                ipcRenderer.invoke('model:get-provider-config'), // Provider 설정 로드
                ipcRenderer.invoke('model:get-all-keys'),
                ipcRenderer.invoke('model:get-available-models', { type: 'llm' }),
                ipcRenderer.invoke('model:get-available-models', { type: 'stt' }),
                ipcRenderer.invoke('model:get-selected-models'),
                ipcRenderer.invoke('settings:getPresets'),
                ipcRenderer.invoke('get-content-protection-status'),
                ipcRenderer.invoke('get-current-shortcuts')
            ]);
            
            if (userState && userState.isLoggedIn) this.firebaseUser = userState;
            this.providerConfig = config;
            this.apiKeys = storedKeys;
            this.availableLlmModels = availableLlm;
            this.availableSttModels = availableStt;
            this.selectedLlm = selectedModels.llm;
            this.selectedStt = selectedModels.stt;
            this.presets = presets || [];
            this.isContentProtectionOn = contentProtection;
            this.shortcuts = shortcuts || {};
            if (this.presets.length > 0) {
                const firstUserPreset = this.presets.find(p => p.is_default === 0);
                if (firstUserPreset) this.selectedPreset = firstUserPreset;
            }
        } catch (error) {
            console.error('Error loading initial settings data:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async handleSaveKey(provider) {
        const input = this.shadowRoot.querySelector(`#key-input-${provider}`);
        if (!input) return;
        const key = input.value;
        this.saving = true;

        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('model:validate-key', { provider, key });
        
        if (result.success) {
            this.apiKeys = { ...this.apiKeys, [provider]: key };
            await this.refreshModelData();
        } else {
            alert(`Failed to save ${provider} key: ${result.error}`);
            input.value = this.apiKeys[provider] || '';
        }
        this.saving = false;
    }
    
    async handleClearKey(provider) {
        this.saving = true;
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('model:remove-api-key', { provider });
        this.apiKeys = { ...this.apiKeys, [provider]: '' };
        await this.refreshModelData();
        this.saving = false;
    }

    async refreshModelData() {
        const { ipcRenderer } = window.require('electron');
        const [availableLlm, availableStt, selected] = await Promise.all([
            ipcRenderer.invoke('model:get-available-models', { type: 'llm' }),
            ipcRenderer.invoke('model:get-available-models', { type: 'stt' }),
            ipcRenderer.invoke('model:get-selected-models')
        ]);
        this.availableLlmModels = availableLlm;
        this.availableSttModels = availableStt;
        this.selectedLlm = selected.llm;
        this.selectedStt = selected.stt;
        this.requestUpdate();
    }
    
    async toggleModelList(type) {
        const visibilityProp = type === 'llm' ? 'isLlmListVisible' : 'isSttListVisible';

        if (!this[visibilityProp]) {
            this.saving = true;
            this.requestUpdate();
            
            await this.refreshModelData();

            this.saving = false;
        }

        // 데이터 새로고침 후, 목록의 표시 상태를 토글합니다.
        this[visibilityProp] = !this[visibilityProp];
        this.requestUpdate();
    }
    
    async selectModel(type, modelId) {
        this.saving = true;
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('model:set-selected-model', { type, modelId });
        if (type === 'llm') this.selectedLlm = modelId;
        if (type === 'stt') this.selectedStt = modelId;
        this.isLlmListVisible = false;
        this.isSttListVisible = false;
        this.saving = false;
        this.requestUpdate();
    }

    handleUsePicklesKey(e) {
        e.preventDefault()
        if (this.wasJustDragged) return
    
        console.log("Requesting Firebase authentication from main process...")
        if (window.require) {
          window.require("electron").ipcRenderer.invoke("start-firebase-auth")
        }
      }
    //////// after_modelStateService ////////

    openShortcutEditor() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('open-shortcut-editor');
        }
    }

    connectedCallback() {
        super.connectedCallback();
        
        this.setupEventListeners();
        this.setupIpcListeners();
        this.setupWindowResize();
        this.loadAutoUpdateSetting();
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
        this._shortcutListener = (event, keybinds) => {
            console.log('[SettingsView] Received updated shortcuts:', keybinds);
            this.shortcuts = keybinds;
        };
        
        ipcRenderer.on('user-state-changed', this._userStateListener);
        ipcRenderer.on('settings-updated', this._settingsUpdatedListener);
        ipcRenderer.on('presets-updated', this._presetsUpdatedListener);
        ipcRenderer.on('shortcuts-updated', this._shortcutListener);
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
        if (this._shortcutListener) {
            ipcRenderer.removeListener('shortcuts-updated', this._shortcutListener);
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
        const maxHeight = windowHeight;
        
        this.style.maxHeight = `${maxHeight}px`;
        
        const container = this.shadowRoot?.querySelector('.settings-container');
        if (container) {
            container.style.maxHeight = `${maxHeight}px`;
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

    // getMainShortcuts() {
    //     return [
    //         { name: 'Show / Hide', key: '\\' },
    //         { name: 'Ask Anything', key: '↵' },
    //         { name: 'Scroll AI Response', key: '↕' }
    //     ];
    // }
    getMainShortcuts() {
        return [
            { name: 'Show / Hide', accelerator: this.shortcuts.toggleVisibility },
            { name: 'Ask Anything', accelerator: this.shortcuts.nextStep },
            { name: 'Scroll Up Response', accelerator: this.shortcuts.scrollUp },
            { name: 'Scroll Down Response', accelerator: this.shortcuts.scrollDown },
        ];
    }

    renderShortcutKeys(accelerator) {
        if (!accelerator) return html`N/A`;
        
        const keyMap = {
            'Cmd': '⌘', 'Command': '⌘', 'Ctrl': '⌃', 'Alt': '⌥', 'Shift': '⇧', 'Enter': '↵',
            'Up': '↑', 'Down': '↓', 'Left': '←', 'Right': '→'
        };

        // scrollDown/scrollUp의 특수 처리
        if (accelerator.includes('↕')) {
            const keys = accelerator.replace('↕','').split('+');
            keys.push('↕');
             return html`${keys.map(key => html`<span class="shortcut-key">${keyMap[key] || key}</span>`)}`;
        }

        const keys = accelerator.split('+');
        return html`${keys.map(key => html`<span class="shortcut-key">${keyMap[key] || key}</span>`)}`;
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


    //////// before_modelStateService ////////
    // render() {
    //     if (this.isLoading) {
    //         return html`
    //             <div class="settings-container">
    //                 <div class="loading-state">
    //                     <div class="loading-spinner"></div>
    //                     <span>Loading...</span>
    //                 </div>
    //             </div>
    //         `;
    //     }

    //     const loggedIn = !!this.firebaseUser;

    //     return html`
    //         <div class="settings-container">
    //             <div class="header-section">
    //                 <div>
    //                     <h1 class="app-title">Pickle Glass</h1>
    //                     <div class="account-info">
    //                         ${this.firebaseUser
    //                             ? html`Account: ${this.firebaseUser.email || 'Logged In'}`
    //                             : this.apiKey && this.apiKey.length > 10
    //                                 ? html`API Key: ${this.apiKey.substring(0, 6)}...${this.apiKey.substring(this.apiKey.length - 6)}`
    //                                 : `Account: Not Logged In`
    //                         }
    //                     </div>
    //                 </div>
    //                 <div class="invisibility-icon ${this.isContentProtectionOn ? 'visible' : ''}" title="Invisibility is On">
    //                     <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    //                         <path d="M9.785 7.41787C8.7 7.41787 7.79 8.19371 7.55667 9.22621C7.0025 8.98704 6.495 9.05121 6.11 9.22037C5.87083 8.18204 4.96083 7.41787 3.88167 7.41787C2.61583 7.41787 1.58333 8.46204 1.58333 9.75121C1.58333 11.0404 2.61583 12.0845 3.88167 12.0845C5.08333 12.0845 6.06333 11.1395 6.15667 9.93787C6.355 9.79787 6.87417 9.53537 7.51 9.94954C7.615 11.1454 8.58333 12.0845 9.785 12.0845C11.0508 12.0845 12.0833 11.0404 12.0833 9.75121C12.0833 8.46204 11.0508 7.41787 9.785 7.41787ZM3.88167 11.4195C2.97167 11.4195 2.2425 10.6729 2.2425 9.75121C2.2425 8.82954 2.9775 8.08287 3.88167 8.08287C4.79167 8.08287 5.52083 8.82954 5.52083 9.75121C5.52083 10.6729 4.79167 11.4195 3.88167 11.4195ZM9.785 11.4195C8.875 11.4195 8.14583 10.6729 8.14583 9.75121C8.14583 8.82954 8.875 8.08287 9.785 8.08287C10.695 8.08287 11.43 8.82954 11.43 9.75121C11.43 10.6729 10.6892 11.4195 9.785 11.4195ZM12.6667 5.95954H1V6.83454H12.6667V5.95954ZM8.8925 1.36871C8.76417 1.08287 8.4375 0.931207 8.12833 1.03037L6.83333 1.46204L5.5325 1.03037L5.50333 1.02454C5.19417 0.93704 4.8675 1.10037 4.75083 1.39787L3.33333 5.08454H10.3333L8.91 1.39787L8.8925 1.36871Z" fill="white"/>
    //                     </svg>
    //                 </div>
    //             </div>

    //             <div class="api-key-section">
    //                 <input 
    //                     type="password" 
    //                     id="api-key-input"
    //                     placeholder="Enter API Key" 
    //                     .value=${this.apiKey || ''}
    //                     ?disabled=${loggedIn}
    //                 >
    //                 <button class="settings-button full-width" @click=${this.handleSaveApiKey} ?disabled=${loggedIn}>
    //                     Save API Key
    //                 </button>
    //             </div>

    //             <div class="shortcuts-section">
    //                 ${this.getMainShortcuts().map(shortcut => html`
    //                     <div class="shortcut-item">
    //                         <span class="shortcut-name">${shortcut.name}</span>
    //                         <div class="shortcut-keys">
    //                             <span class="cmd-key">⌘</span>
    //                             <span class="shortcut-key">${shortcut.key}</span>
    //                         </div>
    //                     </div>
    //                 `)}
    //             </div>

    //             <!-- Preset Management Section -->
    //             <div class="preset-section">
    //                 <div class="preset-header">
    //                     <span class="preset-title">
    //                         My Presets
    //                         <span class="preset-count">(${this.presets.filter(p => p.is_default === 0).length})</span>
    //                     </span>
    //                     <span class="preset-toggle" @click=${this.togglePresets}>
    //                         ${this.showPresets ? '▼' : '▶'}
    //                     </span>
    //                 </div>
                    
    //                 <div class="preset-list ${this.showPresets ? '' : 'hidden'}">
    //                     ${this.presets.filter(p => p.is_default === 0).length === 0 ? html`
    //                         <div class="no-presets-message">
    //                             No custom presets yet.<br>
    //                             <span class="web-link" @click=${this.handlePersonalize}>
    //                                 Create your first preset
    //                             </span>
    //                         </div>
    //                     ` : this.presets.filter(p => p.is_default === 0).map(preset => html`
    //                         <div class="preset-item ${this.selectedPreset?.id === preset.id ? 'selected' : ''}"
    //                              @click=${() => this.handlePresetSelect(preset)}>
    //                             <span class="preset-name">${preset.title}</span>
    //                             ${this.selectedPreset?.id === preset.id ? html`<span class="preset-status">Selected</span>` : ''}
    //                         </div>
    //                     `)}
    //                 </div>
    //             </div>

    //             <div class="buttons-section">
    //                 <button class="settings-button full-width" @click=${this.handlePersonalize}>
    //                     <span>Personalize / Meeting Notes</span>
    //                 </button>
                    
    //                 <div class="move-buttons">
    //                     <button class="settings-button half-width" @click=${this.handleMoveLeft}>
    //                         <span>← Move</span>
    //                     </button>
    //                     <button class="settings-button half-width" @click=${this.handleMoveRight}>
    //                         <span>Move →</span>
    //                     </button>
    //                 </div>
                    
    //                 <button class="settings-button full-width" @click=${this.handleToggleInvisibility}>
    //                     <span>${this.isContentProtectionOn ? 'Disable Invisibility' : 'Enable Invisibility'}</span>
    //                 </button>
                    
    //                 <div class="bottom-buttons">
    //                     ${this.firebaseUser
    //                         ? html`
    //                             <button class="settings-button half-width danger" @click=${this.handleFirebaseLogout}>
    //                                 <span>Logout</span>
    //                             </button>
    //                             `
    //                         : html`
    //                             <button class="settings-button half-width danger" @click=${this.handleClearApiKey}>
    //                                 <span>Clear API Key</span>
    //                             </button>
    //                             `
    //                     }
    //                     <button class="settings-button half-width danger" @click=${this.handleQuit}>
    //                         <span>Quit</span>
    //                     </button>
    //                 </div>
    //             </div>
    //         </div>
    //     `;
    // }
    //////// before_modelStateService ////////

    //////// after_modelStateService ////////
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

        const apiKeyManagementHTML = html`
            <div class="api-key-section">
                ${Object.entries(this.providerConfig)
                    .filter(([id, config]) => !id.includes('-glass'))
                    .map(([id, config]) => html`
                        <div class="provider-key-group">
                            <label for="key-input-${id}">${config.name} API Key</label>
                            <input type="password" id="key-input-${id}"
                                placeholder=${loggedIn ? "Using Pickle's Key" : `Enter ${config.name} API Key`} 
                                .value=${this.apiKeys[id] || ''}
                                
                            >
                            <div class="key-buttons">
                               <button class="settings-button" @click=${() => this.handleSaveKey(id)} >Save</button>
                               <button class="settings-button danger" @click=${() => this.handleClearKey(id)} }>Clear</button>
                            </div>
                        </div>
                    `)}
            </div>
        `;
        
        const getModelName = (type, id) => {
            const models = type === 'llm' ? this.availableLlmModels : this.availableSttModels;
            const model = models.find(m => m.id === id);
            return model ? model.name : id;
        }

        const modelSelectionHTML = html`
            <div class="model-selection-section">
                <div class="model-select-group">
                    <label>LLM Model: <strong>${getModelName('llm', this.selectedLlm) || 'Not Set'}</strong></label>
                    <button class="settings-button full-width" @click=${() => this.toggleModelList('llm')} ?disabled=${this.saving || this.availableLlmModels.length === 0}>
                        Change LLM Model
                    </button>
                    ${this.isLlmListVisible ? html`
                        <div class="model-list">
                            ${this.availableLlmModels.map(model => html`
                                <div class="model-item ${this.selectedLlm === model.id ? 'selected' : ''}" @click=${() => this.selectModel('llm', model.id)}>
                                    ${model.name}
                                </div>
                            `)}
                        </div>
                    ` : ''}
                </div>
                <div class="model-select-group">
                    <label>STT Model: <strong>${getModelName('stt', this.selectedStt) || 'Not Set'}</strong></label>
                    <button class="settings-button full-width" @click=${() => this.toggleModelList('stt')} ?disabled=${this.saving || this.availableSttModels.length === 0}>
                        Change STT Model
                    </button>
                    ${this.isSttListVisible ? html`
                        <div class="model-list">
                            ${this.availableSttModels.map(model => html`
                                <div class="model-item ${this.selectedStt === model.id ? 'selected' : ''}" @click=${() => this.selectModel('stt', model.id)}>
                                    ${model.name}
                                </div>
                            `)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        return html`
            <div class="settings-container">
                <div class="header-section">
                    <div>
                        <h1 class="app-title">Pickle Glass</h1>
                        <div class="account-info">
                            ${this.firebaseUser
                                ? html`Account: ${this.firebaseUser.email || 'Logged In'}`
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

                ${apiKeyManagementHTML}
                ${modelSelectionHTML}

                <div class="buttons-section" style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 6px; margin-top: 6px;">
                    <button class="settings-button full-width" @click=${this.openShortcutEditor}>
                        Edit Shortcuts
                    </button>
                </div>

                
                <div class="shortcuts-section">
                    ${this.getMainShortcuts().map(shortcut => html`
                        <div class="shortcut-item">
                            <span class="shortcut-name">${shortcut.name}</span>
                            <div class="shortcut-keys">
                                ${this.renderShortcutKeys(shortcut.accelerator)}
                            </div>
                        </div>
                    `)}
                </div>

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
                    <button class="settings-button full-width" @click=${this.handleToggleAutoUpdate} ?disabled=${this.autoUpdateLoading}>
                        <span>Automatic Updates: ${this.autoUpdateEnabled ? 'On' : 'Off'}</span>
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
                                <button class="settings-button half-width" @click=${this.handleUsePicklesKey}>
                                    <span>Login</span>
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
    //////// after_modelStateService ////////
}

customElements.define('settings-view', SettingsView);