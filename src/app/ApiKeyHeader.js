import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class ApiKeyHeader extends LitElement {
    static properties = {
        apiKey: { type: String },
        isLoading: { type: Boolean },
        errorMessage: { type: String },
        loadingOperation: { type: String },
        sttProvider: { type: String },
        whisperModel: { type: String },
        showSttSettings: { type: Boolean },
    };

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
            font-weight: 500; /* Medium */
            margin: 0;
            text-align: center;
            flex-shrink: 0; /* 제목이 줄어들지 않도록 고정 */
        }

        .form-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            margin-top: auto; /* 이 속성이 제목과 폼 사이의 공간을 만듭니다. */
        }

        .error-message {
            color: rgba(239, 68, 68, 0.9);
            font-weight: 500;
            font-size: 11px;
            height: 14px; /* Reserve space to prevent layout shift */
            text-align: center;
            margin-bottom: 4px;
        }

        .api-input {
            width: 100%;
            height: 34px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            border: none;
            padding: 0 10px;
            color: white;
            font-size: 12px;
            font-weight: 400; /* Regular */
            margin-bottom: 6px;
            text-align: center;
            user-select: text;
            cursor: text;
        }

        .api-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }

        .api-input:focus {
            outline: none;
        }

        .action-button {
            width: 100%;
            height: 34px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 12px;
            font-weight: 500; /* Medium */
            cursor: pointer;
            transition: background 0.15s ease;
            position: relative;
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

        .action-button:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .or-text {
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
            font-weight: 500; /* Medium */
            margin: 10px 0;
        }

        .stt-settings {
            margin-top: 15px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .stt-settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .stt-settings-title {
            color: rgba(255, 255, 255, 0.9);
            font-size: 11px;
            font-weight: 500;
        }

        .stt-toggle-btn {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 4px;
            transition: background 0.15s ease;
        }

        .stt-toggle-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .stt-provider-select, .whisper-model-select {
            width: 100%;
            height: 28px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: white;
            font-size: 11px;
            padding: 0 8px;
            margin-top: 4px;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path fill="white" d="M0 2L4 6L8 2z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 8px;
            padding-right: 24px;
        }

        .stt-provider-select:focus, .whisper-model-select:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.4);
        }

        .stt-provider-select option, .whisper-model-select option {
            background: #2a2a2a;
            color: white;
        }

        .stt-setting-row {
            margin-bottom: 8px;
        }

        .stt-setting-row:last-child {
            margin-bottom: 0;
        }

        .stt-setting-label {
            display: block;
            color: rgba(255, 255, 255, 0.8);
            font-size: 10px;
            margin-bottom: 2px;
        }

        // ...existing CSS...
    `;

    constructor() {
        super();
        this.dragState = null;
        this.wasJustDragged = false;
        this.apiKey = '';
        this.isLoading = false;
        this.errorMessage = '';
        this.loadingOperation = '';
        this.validatedApiKey = null;
        this.sttProvider = 'openai';
        this.whisperModel = 'base';
        this.showSttSettings = false;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
        this.handleUsePicklesKey = this.handleUsePicklesKey.bind(this);
        this.handleUseOllama = this.handleUseOllama.bind(this);
        this.handleSttProviderChange = this.handleSttProviderChange.bind(this);
        this.handleWhisperModelChange = this.handleWhisperModelChange.bind(this);
        this.toggleSttSettings = this.toggleSttSettings.bind(this);
    }

    reset() {
        this.apiKey = '';
        this.isLoading = false;
        this.errorMessage = '';
        this.loadingOperation = '';
        this.validatedApiKey = null;
        this.requestUpdate();
    }

    async handleMouseDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
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

    handleInput(e) {
        this.apiKey = e.target.value;
        this.errorMessage = '';
        console.log('Input changed:', this.apiKey?.length || 0, 'chars');

        this.requestUpdate();
        this.updateComplete.then(() => {
            const inputField = this.shadowRoot?.querySelector('.apikey-input');
            if (inputField && this.isInputFocused) {
                inputField.focus();
            }
        });
    }

    handlePaste(e) {
        e.preventDefault();
        this.errorMessage = '';
        const clipboardText = (e.clipboardData || window.clipboardData).getData('text');
        console.log('Paste event detected:', clipboardText?.substring(0, 10) + '...');

        if (clipboardText) {
            this.apiKey = clipboardText.trim();

            const inputElement = e.target;
            inputElement.value = this.apiKey;
        }

        this.requestUpdate();
        this.updateComplete.then(() => {
            const inputField = this.shadowRoot?.querySelector('.apikey-input');
            if (inputField) {
                inputField.focus();
                inputField.setSelectionRange(inputField.value.length, inputField.value.length);
            }
        });
    }

    handleKeyPress(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.handleSubmit();
        }
    }

    async handleSubmit() {
        if (this.wasJustDragged || this.isLoading || !this.apiKey.trim()) {
            console.log('Submit blocked:', {
                wasJustDragged: this.wasJustDragged,
                isLoading: this.isLoading,
                hasApiKey: !!this.apiKey.trim(),
            });
            return;
        }

        console.log('Starting API key validation...');
        this.isLoading = true;
        this.loadingOperation = 'openai';
        this.errorMessage = '';
        this.requestUpdate();

        const apiKey = this.apiKey.trim();
        let isValid = false;
        try {
            const isValid = await this.validateApiKey(this.apiKey.trim());

            if (isValid) {
                console.log('API key valid - checking system permissions...');
                
                const permissionResult = await this.checkAndRequestPermissions();
                
                if (permissionResult.success) {
                    console.log('All permissions granted - starting slide out animation');
                    this.startSlideOutAnimation();
                    this.validatedApiKey = this.apiKey.trim();
                } else {
                    this.errorMessage = permissionResult.error || 'Permission setup required';
                    console.log('Permission setup incomplete:', permissionResult);
                }
            } else {
                this.errorMessage = 'Invalid API key - please check and try again';
                console.log('API key validation failed');
            }
        } catch (error) {
            console.error('API key validation error:', error);
            this.errorMessage = 'Validation error - please try again';
        } finally {
            this.isLoading = false;
            this.loadingOperation = '';
            this.requestUpdate();
        }
    }

    async validateApiKey(apiKey) {
        if (!apiKey || apiKey.length < 15) return false;
        if (!apiKey.match(/^[A-Za-z0-9_-]+$/)) return false;

        try {
            console.log('Validating API key with openai models endpoint...');

            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (response.ok) {
                const data = await response.json();

                const hasGPTModels = data.data && data.data.some(m => m.id.startsWith('gpt-'));
                if (hasGPTModels) {
                    console.log('API key validation successful - GPT models available');
                    return true;
                } else {
                    console.log('API key valid but no GPT models available');
                    return false;
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.log('API key validation failed:', response.status, errorData.error?.message || 'Unknown error');
                return false;
            }
        } catch (error) {
            console.error('API key validation network error:', error);
            return apiKey.length >= 20; // Fallback for network issues
        }
    }

    async checkAndRequestPermissions() {
        if (!window.require) {
            return { success: true };
        }

        const { ipcRenderer } = window.require('electron');
        
        try {
            const permissions = await ipcRenderer.invoke('check-system-permissions');
            console.log('[Permissions] Current status:', permissions);
            
            if (!permissions.needsSetup) {
                return { success: true };
            }

            if (!permissions.microphone) {
                console.log('[Permissions] Requesting microphone permission...');
                const micResult = await ipcRenderer.invoke('request-microphone-permission');
                
                if (!micResult.success) {
                    console.log('[Permissions] Microphone permission denied');
                    await ipcRenderer.invoke('open-system-preferences', 'microphone');
                    return { 
                        success: false, 
                        error: 'Please grant microphone access in System Preferences' 
                    };
                }
            }

            if (!permissions.screen) {
                console.log('[Permissions] Screen recording permission needed');
                await ipcRenderer.invoke('open-system-preferences', 'screen-recording');
                
                this.errorMessage = 'Please grant screen recording permission and try again';
                this.requestUpdate();
                
                return { 
                    success: false, 
                    error: 'Please grant screen recording access in System Preferences' 
                };
            }

            return { success: true };
        } catch (error) {
            console.error('[Permissions] Error checking/requesting permissions:', error);
            return { 
                success: false, 
                error: 'Failed to check permissions' 
            };
        }
    }

    startSlideOutAnimation() {
        this.classList.add('sliding-out');
    }

    handleUsePicklesKey(e) {
        e.preventDefault();
        if (this.wasJustDragged) return;

        console.log('Requesting Firebase authentication from main process...');
        if (window.require) {
            window.require('electron').ipcRenderer.invoke('start-firebase-auth');
        }
    }

    async handleUseOllama(e) {
        e.preventDefault();
        if (this.wasJustDragged) return;

        console.log('Setting up Ollama as AI provider...');
        this.isLoading = true;
        this.loadingOperation = 'ollama';
        this.errorMessage = '';
        this.requestUpdate();

        try {
            // Check if Ollama is available
            const isOllamaRunning = await this.checkOllamaAvailability();
            
            if (!isOllamaRunning) {
                this.errorMessage = 'Ollama not found. Please install and start Ollama first.';
                console.log('Ollama availability check failed');
                return;
            }

            // Check if default model is available
            const hasDefaultModel = await this.checkOllamaModel('llama3.2');
            
            if (!hasDefaultModel) {
                this.errorMessage = 'Model llama3.2 not found. Run: ollama pull llama3.2';
                console.log('Default model llama3.2 not available');
                return;
            }

            // Configure the system to use Ollama
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                
                // Set model provider to ollama
                const result = await ipcRenderer.invoke('update-model-provider', 'ollama');
                
                if (result.success) {
                    console.log('Ollama configured successfully');
                    
                    // Check system permissions
                    const permissionResult = await this.checkAndRequestPermissions();
                    
                    if (permissionResult.success) {
                        console.log('All permissions granted - starting with Ollama');
                        this.startSlideOutAnimation();
                        // Set a special flag to indicate Ollama mode
                        this.validatedApiKey = 'OLLAMA_MODE';
                    } else {
                        this.errorMessage = permissionResult.error || 'Permission setup required';
                        console.log('Permission setup incomplete:', permissionResult);
                    }
                } else {
                    this.errorMessage = result.error || 'Failed to configure Ollama';
                    console.log('Failed to configure Ollama:', result.error);
                }
            }
        } catch (error) {
            console.error('Error setting up Ollama:', error);
            this.errorMessage = 'Error setting up Ollama - please try again';
        } finally {
            this.isLoading = false;
            this.loadingOperation = '';
            this.requestUpdate();
        }
    }

    async checkOllamaAvailability() {
        try {
            console.log('Checking Ollama availability...');
            const response = await fetch('http://localhost:11434/api/tags', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (response.ok) {
                console.log('Ollama is available and running');
                return true;
            } else {
                console.log(`Ollama responded with status: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log('Ollama not available:', error.message);
            return false;
        }
    }

    async checkOllamaModel(modelName) {
        try {
            console.log(`Checking if Ollama model '${modelName}' is available...`);
            const response = await fetch('http://localhost:11434/api/tags', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            const availableModels = data.models || [];
            
            // Check if the model exists (handle both exact match and tag variations)
            const modelExists = availableModels.some(model => {
                const modelFullName = model.name || model.model;
                return modelFullName === modelName || 
                       modelFullName.startsWith(modelName + ':') ||
                       modelFullName === modelName + ':latest';
            });
            
            if (modelExists) {
                console.log(`Model '${modelName}' is available`);
            } else {
                console.log(`Model '${modelName}' not found. Available models:`, 
                    availableModels.map(m => m.name || m.model));
            }
            
            return modelExists;
        } catch (error) {
            console.log('Error checking Ollama model availability:', error.message);
            return false;
        }
    }

    handleClose() {
        console.log('Close button clicked');
        if (window.require) {
            window.require('electron').ipcRenderer.invoke('quit-application');
        }
    }

    handleAnimationEnd(e) {
        if (e.target !== this) return;

        if (this.classList.contains('sliding-out')) {
            this.classList.remove('sliding-out');
            this.classList.add('hidden');

            if (this.validatedApiKey) {
                if (window.require) {
                    if (this.validatedApiKey === 'OLLAMA_MODE') {
                        // For Ollama mode, notify that we're using local AI
                        window.require('electron').ipcRenderer.invoke('ollama-mode-activated');
                    } else {
                        // For regular API key mode
                        window.require('electron').ipcRenderer.invoke('api-key-validated', this.validatedApiKey);
                    }
                }
                this.validatedApiKey = null;
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadSttSettings();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);

    }

    async handleSttProviderChange(e) {
        const provider = e.target.value;
        const { ipcRenderer } = window.require('electron');
        
        try {
            const result = await ipcRenderer.invoke('update-stt-provider', { 
                provider, 
                model: this.whisperModel 
            });
            
            if (result.success) {
                this.sttProvider = provider;
                this.errorMessage = '';
                console.log(`STT provider changed to: ${provider}`);
            } else {
                this.errorMessage = result.error || 'Failed to update STT provider';
            }
        } catch (error) {
            this.errorMessage = 'Error updating STT provider: ' + error.message;
        }
        
        this.requestUpdate();
    }

    async handleWhisperModelChange(e) {
        const model = e.target.value;
        const { ipcRenderer } = window.require('electron');
        
        try {
            const result = await ipcRenderer.invoke('update-stt-provider', { 
                provider: 'whisper', 
                model 
            });
            
            if (result.success) {
                this.whisperModel = model;
                this.errorMessage = '';
                console.log(`Whisper model changed to: ${model}`);
            } else {
                this.errorMessage = result.error || 'Failed to update Whisper model';
            }
        } catch (error) {
            this.errorMessage = 'Error updating Whisper model: ' + error.message;
        }
        
        this.requestUpdate();
    }

    toggleSttSettings() {
        this.showSttSettings = !this.showSttSettings;
        this.requestUpdate();
    }

    async loadSttSettings() {
        const { ipcRenderer } = window.require('electron');
        
        try {
            const result = await ipcRenderer.invoke('get-stt-provider');
            if (result.success) {
                this.sttProvider = result.provider;
                this.whisperModel = result.whisperModel;
                this.requestUpdate();
            }
        } catch (error) {
            console.error('Error loading STT settings:', error);
        }
    }

    render() {
        const isButtonDisabled = this.isLoading || !this.apiKey || !this.apiKey.trim();

        return html`
            <div class="container" @mousedown=${this.handleMouseDown}>
                <button class="close-button" @click=${this.handleClose} title="Close application">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
                    </svg>
                </button>
                <h1 class="title">Choose how to power your AI</h1>

                <div class="form-content">
                    <div class="error-message">${this.errorMessage}</div>
                    <input
                        type="password"
                        class="api-input"
                        placeholder="Enter your OpenAI API key"
                        .value=${this.apiKey || ''}
                        @input=${this.handleInput}
                        @keypress=${this.handleKeyPress}
                        @paste=${this.handlePaste}
                        @focus=${() => (this.errorMessage = '')}
                        ?disabled=${this.isLoading}
                        autocomplete="off"
                        spellcheck="false"
                        tabindex="0"
                    />

                    <button class="action-button" @click=${this.handleSubmit} ?disabled=${isButtonDisabled} tabindex="0">
                        ${this.isLoading && this.loadingOperation === 'openai' ? 'Validating...' : 'Confirm'}
                    </button>

                    <div class="or-text">or</div>

                    <button class="action-button" @click=${this.handleUsePicklesKey}>Use Pickle's API Key</button>
                    <button class="action-button" @click=${this.handleUseOllama} ?disabled=${this.isLoading}>
                        ${this.isLoading && this.loadingOperation === 'ollama' ? 'Setting up Ollama...' : 'Use your local Ollama (Defaults to Llama3.2)'}
                    </button>

                    <div class="stt-settings">
                        <div class="stt-settings-header">
                            <div class="stt-settings-title">Speech-to-Text Settings</div>
                            <button class="stt-toggle-btn" @click=${this.toggleSttSettings}>
                                ${this.showSttSettings ? '▲' : '▼'}
                            </button>
                        </div>

                        ${this.showSttSettings
                            ? html`
                                <div class="stt-setting-row">
                                    <label class="stt-setting-label">Provider</label>
                                    <select class="stt-provider-select" @change=${this.handleSttProviderChange}>
                                        <option value="openai" ?selected=${this.sttProvider === 'openai'}>OpenAI</option>
                                        <option value="whisper" ?selected=${this.sttProvider === 'whisper'}>Local Whisper</option>
                                    </select>
                                </div>

                                ${this.sttProvider === 'whisper'
                                    ? html`
                                        <div class="stt-setting-row">
                                            <label class="stt-setting-label">Model</label>
                                            <select class="whisper-model-select" @change=${this.handleWhisperModelChange}>
                                                <option value="base" ?selected=${this.whisperModel === 'base'}>Base</option>
                                                <option value="tiny" ?selected=${this.whisperModel === 'tiny'}>Tiny</option>
                                                <option value="small" ?selected=${this.whisperModel === 'small'}>Small</option>
                                                <option value="medium" ?selected=${this.whisperModel === 'medium'}>Medium</option>
                                                <option value="large" ?selected=${this.whisperModel === 'large'}>Large</option>
                                            </select>
                                        </div>
                                    `
                                    : ''
                                }
                            `
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('apikey-header', ApiKeyHeader);
