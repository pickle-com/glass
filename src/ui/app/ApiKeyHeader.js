import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class ApiKeyHeader extends LitElement {
    //////// after_modelStateService ////////
    static properties = {
        llmApiKey: { type: String },
        sttApiKey: { type: String },
        llmProvider: { type: String },
        sttProvider: { type: String },
        isLoading: { type: Boolean },
        errorMessage: { type: String },
        successMessage: { type: String },
        providers: { type: Object, state: true },
        modelSuggestions: { type: Array, state: true },
        userModelHistory: { type: Array, state: true },
        selectedLlmModel: { type: String, state: true },
        selectedSttModel: { type: String, state: true },
        ollamaStatus: { type: Object, state: true },
        installingModel: { type: String, state: true },
        installProgress: { type: Number, state: true },
        whisperInstallingModels: { type: Object, state: true },
        backCallback: { type: Function },
        llmError: { type: String },
        sttError: { type: String },
    };
    //////// after_modelStateService ////////

    static styles = css`
        :host {
            display: block;
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                'Segoe UI',
                Roboto,
                sans-serif;
        }
        * {
            box-sizing: border-box;
        }
        .container {
            width: 100%;
            height: 100%;
            padding: 24px 16px;
            background: rgba(0, 0, 0, 0.64);
            box-shadow: 0px 0px 0px 1.5px rgba(255, 255, 255, 0.64) inset;
            border-radius: 16px;
            flex-direction: column;
            justify-content: flex-start;
            align-items: flex-start;
            gap: 24px;
            display: flex;
            -webkit-app-region: drag;
        }
        .header {
            width: 100%;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 8px;
        }
        .close-button {
            -webkit-app-region: no-drag;
            position: absolute;
            top: 16px;
            right: 16px;
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 5px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            z-index: 10;
            font-size: 16px;
            line-height: 1;
            padding: 0;
        }
        .close-button:hover {
            background: rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.9);
        }
        .back-button {
            -webkit-app-region: no-drag;
            padding: 8px;
            left: 0px;
            top: -7px;
            position: absolute;
            background: rgba(132.6, 132.6, 132.6, 0.8);
            border-radius: 16px;
            border: 0.5px solid rgba(255, 255, 255, 0.5);
            justify-content: center;
            align-items: center;
            gap: 4px;
            display: flex;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .back-button:hover {
            background: rgba(150, 150, 150, 0.9);
        }
        .arrow-icon-left {
            border: solid #dcdcdc;
            border-width: 0 1.2px 1.2px 0;
            display: inline-block;
            padding: 3px;
            transform: rotate(135deg);
        }
        .back-button-text {
            color: white;
            font-size: 12px;
            font-weight: 500;
            padding-right: 4px;
        }
        .title {
            color: white;
            font-size: 14px;
            font-weight: 700;
        }
        .section {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .row {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .label {
            color: white;
            font-size: 12px;
            font-weight: 600;
        }
        .provider-selector {
            display: flex;
            width: 240px;
            overflow: hidden;
            border-radius: 12px;
            border: 0.5px solid rgba(255, 255, 255, 0.5);
        }
        .provider-button {
            -webkit-app-region: no-drag;
            padding: 4px 8px;
            background: rgba(20.4, 20.4, 20.4, 0.32);
            color: #dcdcdc;
            font-size: 11px;
            font-weight: 450;
            letter-spacing: 0.11px;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s ease;
            flex: 1;
        }
        .provider-button:hover {
            background: rgba(80, 80, 80, 0.48);
        }
        .provider-button[data-status='active'] {
            background: rgba(142.8, 142.8, 142.8, 0.48);
            color: white;
        }
        .api-input {
            -webkit-app-region: no-drag;
            width: 240px;
            padding: 10px 8px;
            background: rgba(61.2, 61.2, 61.2, 0.8);
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.24);
            color: white;
            font-size: 11px;
            text-overflow: ellipsis;
            font-family: inherit;
            line-height: inherit;
        }
        .ollama-action-button {
            -webkit-app-region: no-drag;
            width: 240px;
            padding: 10px 8px;
            border-radius: 16px;
            border: none;
            color: white;
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            text-align: center;
            transition: background-color 0.2s ease;
        }
        .ollama-action-button.install {
            background: rgba(0, 122, 255, 0.2);
        }
        .ollama-action-button.start {
            background: rgba(255, 200, 0, 0.2);
        }
        select.api-input {
            -webkit-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 0.5rem center;
            background-repeat: no-repeat;
            background-size: 1.5em 1.5em;
            padding-right: 2.5rem;
        }
        select.api-input option {
            background: #333;
            color: white;
        }
        .api-input::placeholder {
            color: #a0a0a0;
        }
        .confirm-button-container {
            width: 100%;
            display: flex;
            justify-content: flex-end;
        }
        .confirm-button {
            -webkit-app-region: no-drag;
            width: 240px;
            padding: 8px;
            background: rgba(132.6, 132.6, 132.6, 0.8);
            box-shadow: 0px 2px 2px rgba(0, 0, 0, 0.16);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            color: white;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .confirm-button:hover {
            background: rgba(150, 150, 150, 0.9);
        }
        .confirm-button:disabled {
            background: rgba(255, 255, 255, 0.12);
            color: #bebebe;
            border: 0.5px solid rgba(255, 255, 255, 0.24);
            box-shadow: none;
            cursor: not-allowed;
        }
        .footer {
            width: 100%;
            text-align: center;
            color: #dcdcdc;
            font-size: 12px;
            font-weight: 500;
            line-height: 18px;
        }
        .footer-link {
            text-decoration: underline;
            cursor: pointer;
            -webkit-app-region: no-drag;
        }
        .error-message,
        .success-message {
            position: absolute;
            bottom: 70px;
            left: 16px;
            right: 16px;
            text-align: center;
            font-size: 11px;
            font-weight: 500;
            padding: 4px;
            border-radius: 4px;
        }
        .error-message {
            color: rgba(239, 68, 68, 0.9);
        }
        .success-message {
            color: rgba(74, 222, 128, 0.9);
        }
        .message-fade-out {
            animation: fadeOut 3s ease-in-out forwards;
        }
        @keyframes fadeOut {
            0% {
                opacity: 1;
            }
            66% {
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }
        .sliding-out {
            animation: slideOut 0.3s ease-out forwards;
        }
        @keyframes slideOut {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(-100%);
                opacity: 0;
            }
        }
        .api-input.invalid {
            outline: 1px solid #ff7070;
            outline-offset: -1px;
        }
        .input-wrapper {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
        }
        .inline-error-message {
            color: #ff7070;
            font-size: 11px;
            font-weight: 400;
            letter-spacing: 0.11px;
            word-wrap: break-word;
            width: 240px;
        }
    `;


    constructor() {
        super();
        this.isLoading = false;
        this.errorMessage = '';
        this.successMessage = '';
        this.messageTimestamp = 0;
        //////// after_modelStateService ////////
        this.llmApiKey = '';
        this.sttApiKey = '';
        this.llmProvider = 'openai';
        this.sttProvider = 'openai';
        this.providers = { llm: [], stt: [] }; // 초기화
        // Ollama related
        this.modelSuggestions = [];
        this.userModelHistory = [];
        this.selectedLlmModel = '';
        this.selectedSttModel = '';
        this.ollamaStatus = { installed: false, running: false };
        this.installingModel = null;
        this.installProgress = 0;
        this.whisperInstallingModels = {};
        this.backCallback = () => {};
        this.llmError = '';
        this.sttError = '';

        // Professional operation management system
        this.activeOperations = new Map();
        this.operationTimeouts = new Map();
        this.connectionState = 'idle'; // idle, connecting, connected, failed, disconnected
        this.lastStateChange = Date.now();
        this.retryCount = 0;
        this.maxRetries = 3;
        this.baseRetryDelay = 1000;

        // Backpressure and resource management
        this.operationQueue = [];
        this.maxConcurrentOperations = 2;
        this.maxQueueSize = 5;
        this.operationMetrics = {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            timeouts: 0,
            averageResponseTime: 0,
        };

        // Configuration
        this.ipcTimeout = 10000; // 10s for IPC calls
        this.operationTimeout = 15000; // 15s for complex operations

        // Health monitoring system
        this.healthCheck = {
            enabled: false,
            intervalId: null,
            intervalMs: 30000, // 30s
            lastCheck: 0,
            consecutiveFailures: 0,
            maxFailures: 3,
        };

        // Load user model history from localStorage
        this.loadUserModelHistory();
        this.loadProviderConfig();
        //////// after_modelStateService ////////

        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
        this.handleProviderChange = this.handleProviderChange.bind(this);
        this.handleLlmProviderChange = this.handleLlmProviderChange.bind(this);
        this.handleSttProviderChange = this.handleSttProviderChange.bind(this);
        this.handleMessageFadeEnd = this.handleMessageFadeEnd.bind(this);
        this.handleModelKeyPress = this.handleModelKeyPress.bind(this);
        this.handleSttModelChange = this.handleSttModelChange.bind(this);
        this.handleBack = this.handleBack.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        this.dispatchEvent(new CustomEvent('content-changed', { bubbles: true, composed: true }));
    }

    reset() {
        this.apiKey = '';
        this.isLoading = false;
        this.errorMessage = '';
        this.validatedApiKey = null;
        this.selectedProvider = 'openai';
        this.requestUpdate();
    }

    handleBack() {
        if (this.backCallback) {
            this.backCallback();
        }
    }

    async loadProviderConfig() {
        if (!window.api?.apiKeyHeader) return;

        try {
            const [config, ollamaStatus] = await Promise.all([
                window.api.apiKeyHeader.getProviderConfig(),
                window.api.apiKeyHeader.getOllamaStatus(),
            ]);

            const llmProviders = [];
            const sttProviders = [];

            for (const id in config) {
                // 'openai-glass' 같은 가상 Provider는 UI에 표시하지 않음
                if (id.includes('-glass')) continue;
                const hasLlmModels = config[id].llmModels.length > 0 || id === 'ollama';
                const hasSttModels = config[id].sttModels.length > 0 || id === 'whisper';

                if (hasLlmModels) {
                    llmProviders.push({ id, name: config[id].name });
                }
                if (hasSttModels) {
                    sttProviders.push({ id, name: config[id].name });
                }
            }

            this.providers = { llm: llmProviders, stt: sttProviders };

            // 기본 선택 값 설정
            if (llmProviders.length > 0) this.llmProvider = llmProviders[0].id;
            if (sttProviders.length > 0) this.sttProvider = sttProviders[0].id;

            // Ollama 상태 및 모델 제안 로드
            if (ollamaStatus?.success) {
                this.ollamaStatus = {
                    installed: ollamaStatus.installed,
                    running: ollamaStatus.running,
                };

                // Load model suggestions if Ollama is running
                if (ollamaStatus.running) {
                    await this.loadModelSuggestions();
                }
            }

            this.requestUpdate();
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to load provider config:', error);
        }
    }

    async handleMouseDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') {
            return;
        }

        e.preventDefault();

        if (!window.api?.apiKeyHeader) return;
        const initialPosition = await window.api.apiKeyHeader.getHeaderPosition();

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

        if (window.api?.apiKeyHeader) {
            window.api.apiKeyHeader.moveHeaderTo(newWindowX, newWindowY);
        }
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
        this.clearMessages();
        console.log('Input changed:', this.apiKey?.length || 0, 'chars');

        this.requestUpdate();
        this.updateComplete.then(() => {
            const inputField = this.shadowRoot?.querySelector('.apikey-input');
            if (inputField && this.isInputFocused) {
                inputField.focus();
            }
        });
    }

    clearMessages() {
        this.errorMessage = '';
        this.successMessage = '';
        this.messageTimestamp = 0;
        this.llmError = '';
        this.sttError = '';
    }

    handleProviderChange(e) {
        this.selectedProvider = e.target.value;
        this.clearMessages();
        console.log('Provider changed to:', this.selectedProvider);
        this.requestUpdate();
    }

    async handleLlmProviderChange(e, providerId) {
        const newProvider = providerId || e.target.value;
        if (newProvider === this.llmProvider) return;

        // Cancel any active operations first
        this._cancelAllActiveOperations();

        this.llmProvider = newProvider;
        this.errorMessage = '';
        this.successMessage = '';

        if (['openai', 'gemini'].includes(this.llmProvider)) {
            this.sttProvider = this.llmProvider;
        }

        // Reset retry state
        this.retryCount = 0;

        if (this.llmProvider === 'ollama') {
            console.log('[ApiKeyHeader] Ollama selected, initiating connection...');
            await this._initializeOllamaConnection();
            // Start health monitoring for Ollama
            this._startHealthMonitoring();
        } else {
            this._updateConnectionState('idle', 'Non-Ollama provider selected');
            // Stop health monitoring for non-Ollama providers
            this._stopHealthMonitoring();
        }

        this.requestUpdate();
    }

    async _initializeOllamaConnection() {
        try {
            // Progressive connection attempt with exponential backoff
            await this._attemptOllamaConnection();
        } catch (error) {
            console.error('[ApiKeyHeader] Initial Ollama connection failed:', error.message);

            if (this.retryCount < this.maxRetries) {
                const delay = this.baseRetryDelay * Math.pow(2, this.retryCount);
                console.log(`[ApiKeyHeader] Retrying Ollama connection in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`);

                this.retryCount++;

                // Use proper Promise-based delay instead of setTimeout
                await new Promise(resolve => {
                    const retryTimeoutId = setTimeout(() => {
                        this._initializeOllamaConnection();
                        resolve();
                    }, delay);

                    // Store timeout for cleanup
                    this.operationTimeouts.set(`retry_${this.retryCount}`, retryTimeoutId);
                });
            } else {
                this._updateConnectionState('failed', `Connection failed after ${this.maxRetries} attempts`);
            }
        }
    }

    async _attemptOllamaConnection() {
        await this.refreshOllamaStatus();
    }

    _cancelAllActiveOperations() {
        console.log(`[ApiKeyHeader] Cancelling ${this.activeOperations.size} active operations and ${this.operationQueue.length} queued operations`);

        // Cancel active operations
        for (const [operationType, operation] of this.activeOperations) {
            this._cancelOperation(operationType);
        }

        // Cancel queued operations
        for (const queuedOp of this.operationQueue) {
            queuedOp.reject(new Error(`Operation ${queuedOp.type} cancelled during cleanup`));
        }
        this.operationQueue.length = 0;

        // Clean up all timeouts
        for (const [timeoutId, timeout] of this.operationTimeouts) {
            clearTimeout(timeout);
        }
        this.operationTimeouts.clear();
    }

    /**
     * Get operation metrics for monitoring
     */
    getOperationMetrics() {
        return {
            ...this.operationMetrics,
            activeOperations: this.activeOperations.size,
            queuedOperations: this.operationQueue.length,
            successRate:
                this.operationMetrics.totalOperations > 0
                    ? (this.operationMetrics.successfulOperations / this.operationMetrics.totalOperations) * 100
                    : 0,
        };
    }

    /**
     * Adaptive backpressure based on system performance
     */
    _adjustBackpressureThresholds() {
        const metrics = this.getOperationMetrics();

        // Reduce concurrent operations if success rate is low
        if (metrics.successRate < 70 && this.maxConcurrentOperations > 1) {
            this.maxConcurrentOperations = Math.max(1, this.maxConcurrentOperations - 1);
            console.log(
                `[ApiKeyHeader] Reduced max concurrent operations to ${this.maxConcurrentOperations} (success rate: ${metrics.successRate.toFixed(1)}%)`
            );
        }

        // Increase if performance is good
        if (metrics.successRate > 90 && metrics.averageResponseTime < 3000 && this.maxConcurrentOperations < 3) {
            this.maxConcurrentOperations++;
            console.log(`[ApiKeyHeader] Increased max concurrent operations to ${this.maxConcurrentOperations}`);
        }
    }

    /**
     * Professional health monitoring system
     */
    _startHealthMonitoring() {
        if (this.healthCheck.enabled) return;

        this.healthCheck.enabled = true;
        this.healthCheck.intervalId = setInterval(() => {
            this._performHealthCheck();
        }, this.healthCheck.intervalMs);

        console.log(`[ApiKeyHeader] Health monitoring started (interval: ${this.healthCheck.intervalMs}ms)`);
    }

    _stopHealthMonitoring() {
        if (!this.healthCheck.enabled) return;

        this.healthCheck.enabled = false;
        if (this.healthCheck.intervalId) {
            clearInterval(this.healthCheck.intervalId);
            this.healthCheck.intervalId = null;
        }

        console.log('[ApiKeyHeader] Health monitoring stopped');
    }

    async _performHealthCheck() {
        // Only perform health check if Ollama is selected and we're in a stable state
        if (this.llmProvider !== 'ollama' || this.connectionState === 'connecting') {
            return;
        }

        const now = Date.now();
        this.healthCheck.lastCheck = now;

        try {
            // Lightweight health check - just ping the service
            const isHealthy = await this._executeOperation(
                'health_check',
                async () => {
                    if (!window.api?.apiKeyHeader) return false;
                    const result = await window.api.apiKeyHeader.getOllamaStatus();
                    return result?.success && result?.running;
                },
                { timeout: 5000, priority: 'low' }
            );

            if (isHealthy) {
                this.healthCheck.consecutiveFailures = 0;

                // Update state if we were previously failed
                if (this.connectionState === 'failed') {
                    this._updateConnectionState('connected', 'Health check recovered');
                }
            } else {
                this._handleHealthCheckFailure();
            }

            // Adjust thresholds based on performance
            this._adjustBackpressureThresholds();
        } catch (error) {
            console.warn('[ApiKeyHeader] Health check failed:', error.message);
            this._handleHealthCheckFailure();
        }
    }

    _handleHealthCheckFailure() {
        this.healthCheck.consecutiveFailures++;

        if (this.healthCheck.consecutiveFailures >= this.healthCheck.maxFailures) {
            console.warn(`[ApiKeyHeader] Health check failed ${this.healthCheck.consecutiveFailures} times, marking as disconnected`);
            this._updateConnectionState('failed', 'Service health check failed');

            // Increase health check frequency when having issues
            this.healthCheck.intervalMs = Math.max(10000, this.healthCheck.intervalMs / 2);
            this._restartHealthMonitoring();
        }
    }

    _restartHealthMonitoring() {
        this._stopHealthMonitoring();
        this._startHealthMonitoring();
    }

    /**
     * Get comprehensive health status
     */
    getHealthStatus() {
        return {
            connection: {
                state: this.connectionState,
                lastStateChange: this.lastStateChange,
                timeSinceLastChange: Date.now() - this.lastStateChange,
            },
            operations: this.getOperationMetrics(),
            health: {
                enabled: this.healthCheck.enabled,
                lastCheck: this.healthCheck.lastCheck,
                timeSinceLastCheck: this.healthCheck.lastCheck > 0 ? Date.now() - this.healthCheck.lastCheck : null,
                consecutiveFailures: this.healthCheck.consecutiveFailures,
                intervalMs: this.healthCheck.intervalMs,
            },
            ollama: {
                provider: this.llmProvider,
                status: this.ollamaStatus,
                selectedModel: this.selectedLlmModel,
            },
        };
    }

    async handleSttProviderChange(e, providerId) {
        const newProvider = providerId || e.target.value;
        if (newProvider === this.sttProvider) return;

        this.sttProvider = newProvider;
        this.errorMessage = '';
        this.successMessage = '';

        if (this.sttProvider === 'ollama') {
            console.warn('[ApiKeyHeader] Ollama does not support STT yet. Please select Whisper or another provider.');
            this.sttError = '*Ollama does not support STT yet. Please select Whisper or another STT provider.';
            this.messageTimestamp = Date.now();

            // Auto-select Whisper if available
            const whisperProvider = this.providers.stt.find(p => p.id === 'whisper');
            if (whisperProvider) {
                this.sttProvider = 'whisper';
                console.log('[ApiKeyHeader] Auto-selected Whisper for STT');
            }
        }

        this.requestUpdate();
    }

    /**
     * Professional operation management with backpressure control
     */
    async _executeOperation(operationType, operation, options = {}) {
        const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timeout = options.timeout || this.ipcTimeout;
        const priority = options.priority || 'normal'; // high, normal, low

        // Backpressure control
        if (this.activeOperations.size >= this.maxConcurrentOperations) {
            if (this.operationQueue.length >= this.maxQueueSize) {
                throw new Error(`Operation queue full (${this.maxQueueSize}), rejecting ${operationType}`);
            }

            console.log(`[ApiKeyHeader] Queuing operation ${operationType} (${this.activeOperations.size} active)`);
            return this._queueOperation(operationId, operationType, operation, options);
        }

        return this._executeImmediately(operationId, operationType, operation, timeout);
    }

    async _queueOperation(operationId, operationType, operation, options) {
        return new Promise((resolve, reject) => {
            const queuedOperation = {
                id: operationId,
                type: operationType,
                operation,
                options,
                resolve,
                reject,
                queuedAt: Date.now(),
                priority: options.priority || 'normal',
            };

            // Insert based on priority (high priority first)
            if (options.priority === 'high') {
                this.operationQueue.unshift(queuedOperation);
            } else {
                this.operationQueue.push(queuedOperation);
            }

            console.log(`[ApiKeyHeader] Queued ${operationType} (queue size: ${this.operationQueue.length})`);
        });
    }

    async _executeImmediately(operationId, operationType, operation, timeout) {
        const startTime = Date.now();
        this.operationMetrics.totalOperations++;

        // Check if similar operation is already running
        if (this.activeOperations.has(operationType)) {
            console.log(`[ApiKeyHeader] Operation ${operationType} already in progress, cancelling previous`);
            this._cancelOperation(operationType);
        }

        // Create cancellation mechanism
        const cancellationPromise = new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
                this.operationMetrics.timeouts++;
                reject(new Error(`Operation ${operationType} timeout after ${timeout}ms`));
            }, timeout);

            this.operationTimeouts.set(operationId, timeoutId);
        });

        const operationPromise = Promise.race([operation(), cancellationPromise]);

        this.activeOperations.set(operationType, {
            id: operationId,
            promise: operationPromise,
            startTime,
        });

        try {
            const result = await operationPromise;
            this._recordOperationSuccess(startTime);
            return result;
        } catch (error) {
            this._recordOperationFailure(error, operationType);
            throw error;
        } finally {
            this._cleanupOperation(operationId, operationType);
            this._processQueue();
        }
    }

    _recordOperationSuccess(startTime) {
        this.operationMetrics.successfulOperations++;
        const responseTime = Date.now() - startTime;
        this._updateAverageResponseTime(responseTime);
    }

    _recordOperationFailure(error, operationType) {
        this.operationMetrics.failedOperations++;

        if (error.message.includes('timeout')) {
            console.error(`[ApiKeyHeader] Operation ${operationType} timed out`);
            this._updateConnectionState('failed', `Timeout: ${error.message}`);
        }
    }

    _updateAverageResponseTime(responseTime) {
        const totalOps = this.operationMetrics.successfulOperations;
        this.operationMetrics.averageResponseTime = (this.operationMetrics.averageResponseTime * (totalOps - 1) + responseTime) / totalOps;
    }

    async _processQueue() {
        if (this.operationQueue.length === 0 || this.activeOperations.size >= this.maxConcurrentOperations) {
            return;
        }

        const queuedOp = this.operationQueue.shift();
        if (!queuedOp) return;

        const queueTime = Date.now() - queuedOp.queuedAt;
        console.log(`[ApiKeyHeader] Processing queued operation ${queuedOp.type} (waited ${queueTime}ms)`);

        try {
            const result = await this._executeImmediately(
                queuedOp.id,
                queuedOp.type,
                queuedOp.operation,
                queuedOp.options.timeout || this.ipcTimeout
            );
            queuedOp.resolve(result);
        } catch (error) {
            queuedOp.reject(error);
        }
    }

    _cancelOperation(operationType) {
        const operation = this.activeOperations.get(operationType);
        if (operation) {
            this._cleanupOperation(operation.id, operationType);
            console.log(`[ApiKeyHeader] Cancelled operation: ${operationType}`);
        }
    }

    _cleanupOperation(operationId, operationType) {
        if (this.operationTimeouts.has(operationId)) {
            clearTimeout(this.operationTimeouts.get(operationId));
            this.operationTimeouts.delete(operationId);
        }
        this.activeOperations.delete(operationType);
    }

    _updateConnectionState(newState, reason = '') {
        if (this.connectionState !== newState) {
            console.log(`[ApiKeyHeader] Connection state: ${this.connectionState} -> ${newState} (${reason})`);
            this.connectionState = newState;
            this.lastStateChange = Date.now();

            // Update UI based on state
            this._handleStateChange(newState, reason);
        }
    }

    _handleStateChange(state, reason) {
        switch (state) {
            case 'connecting':
                this.installingModel = 'Connecting to Ollama...';
                this.installProgress = 10;
                break;
            case 'failed':
                this.errorMessage = reason || 'Connection failed';
                this.installingModel = null;
                this.installProgress = 0;
                this.messageTimestamp = Date.now();
                break;
            case 'connected':
                this.installingModel = null;
                this.installProgress = 0;
                break;
            case 'disconnected':
                this.ollamaStatus = { installed: false, running: false };
                break;
        }
        this.requestUpdate();
    }

    async refreshOllamaStatus() {
        if (!window.api?.apiKeyHeader) return;

        try {
            this._updateConnectionState('connecting', 'Checking Ollama status');

            const result = await this._executeOperation('ollama_status', async () => {
                return await window.api.apiKeyHeader.getOllamaStatus();
            });

            if (result?.success) {
                this.ollamaStatus = {
                    installed: result.installed,
                    running: result.running,
                };

                this._updateConnectionState('connected', 'Status updated successfully');

                // Load model suggestions if Ollama is running
                if (result.running) {
                    await this.loadModelSuggestions();
                }
            } else {
                this._updateConnectionState('failed', result?.error || 'Status check failed');
            }
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to refresh Ollama status:', error.message);
            this._updateConnectionState('failed', error.message);
        }
    }

    async loadModelSuggestions() {
        if (!window.api?.apiKeyHeader) return;

        try {
            const result = await this._executeOperation('model_suggestions', async () => {
                return await window.api.apiKeyHeader.getModelSuggestions();
            });

            if (result?.success) {
                this.modelSuggestions = result.suggestions || [];

                // 기본 모델 선택 (설치된 모델 중 첫 번째)
                if (!this.selectedLlmModel && this.modelSuggestions.length > 0) {
                    const installedModel = this.modelSuggestions.find(m => m.status === 'installed');
                    if (installedModel) {
                        this.selectedLlmModel = installedModel.name;
                    }
                }
                this.requestUpdate();
            } else {
                console.warn('[ApiKeyHeader] Model suggestions request unsuccessful:', result?.error);
            }
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to load model suggestions:', error.message);
        }
    }

    async ensureOllamaReady() {
        if (!window.api?.apiKeyHeader) return false;

        try {
            this._updateConnectionState('connecting', 'Ensuring Ollama is ready');

            const result = await this._executeOperation(
                'ollama_ensure_ready',
                async () => {
                    return await window.api.apiKeyHeader.ensureOllamaReady();
                },
                { timeout: this.operationTimeout }
            );

            if (result?.success) {
                await this.refreshOllamaStatus();
                this._updateConnectionState('connected', 'Ollama ready');
                return true;
            } else {
                const errorMsg = `Failed to setup Ollama: ${result?.error || 'Unknown error'}`;
                this._updateConnectionState('failed', errorMsg);
                return false;
            }
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to ensure Ollama ready:', error.message);
            this._updateConnectionState('failed', `Error setting up Ollama: ${error.message}`);
            return false;
        }
    }

    async ensureOllamaReadyWithUI() {
        if (!window.api?.apiKeyHeader) return false;

        this.installingModel = 'Setting up Ollama';
        this.installProgress = 0;
        this.clearMessages();
        this.requestUpdate();

        const progressHandler = (event, data) => {
            // 통합 LocalAI 이벤트에서 Ollama 진행률만 처리
            if (data.service !== 'ollama') return;
            
            let baseProgress = 0;
            let stageTotal = 0;

            switch (data.stage) {
                case 'downloading':
                    baseProgress = 0;
                    stageTotal = 70;
                    break;
                case 'mounting':
                    baseProgress = 70;
                    stageTotal = 10;
                    break;
                case 'installing':
                    baseProgress = 80;
                    stageTotal = 10;
                    break;
                case 'linking':
                    baseProgress = 90;
                    stageTotal = 5;
                    break;
                case 'cleanup':
                    baseProgress = 95;
                    stageTotal = 3;
                    break;
                case 'starting':
                    baseProgress = 98;
                    stageTotal = 2;
                    break;
            }

            const overallProgress = baseProgress + (data.progress / 100) * stageTotal;

            this.installingModel = data.message;
            this.installProgress = Math.round(overallProgress);
            this.requestUpdate();
        };

        let operationCompleted = false;
        const completionTimeout = setTimeout(async () => {
            if (!operationCompleted) {
                console.log('[ApiKeyHeader] Operation timeout, checking status manually...');
                await this._handleOllamaSetupCompletion(true);
            }
        }, 15000); // 15 second timeout

        const completionHandler = async (event, data) => {
            // 통합 LocalAI 이벤트에서 Ollama 완료만 처리
            if (data.service !== 'ollama') return;
            if (operationCompleted) return;
            operationCompleted = true;
            clearTimeout(completionTimeout);

            window.api.apiKeyHeader.removeOnLocalAIProgress(progressHandler);
            // installation-complete 이벤트는 성공을 의미
            await this._handleOllamaSetupCompletion(true);
        };

        // 통합 LocalAI 이벤트 사용
        window.api.apiKeyHeader.onLocalAIComplete(completionHandler);
        window.api.apiKeyHeader.onLocalAIProgress(progressHandler);

        try {
            let result;
            if (!this.ollamaStatus.installed) {
                console.log('[ApiKeyHeader] Ollama not installed. Starting installation.');
                result = await window.api.apiKeyHeader.installOllama();
            } else {
                console.log('[ApiKeyHeader] Ollama installed. Starting service.');
                result = await window.api.apiKeyHeader.startOllamaService();
            }

            // If IPC call succeeds but no event received, handle completion manually
            if (result?.success && !operationCompleted) {
                setTimeout(async () => {
                    if (!operationCompleted) {
                        operationCompleted = true;
                        clearTimeout(completionTimeout);
                        await this._handleOllamaSetupCompletion(true);
                    }
                }, 2000);
            }
        } catch (error) {
            operationCompleted = true;
            clearTimeout(completionTimeout);
            console.error('[ApiKeyHeader] Ollama setup failed:', error);
            window.api.apiKeyHeader.removeOnLocalAIProgress(progressHandler);
            window.api.apiKeyHeader.removeOnLocalAIComplete(completionHandler);
            await this._handleOllamaSetupCompletion(false, error.message);
        }
    }

    async _handleOllamaSetupCompletion(success, errorMessage = null) {
        this.installingModel = null;
        this.installProgress = 0;

        if (success) {
            await this.refreshOllamaStatus();
            this.successMessage = '✓ Ollama is ready!';
        } else {
            this.llmError = `*Setup failed: ${errorMessage || 'Unknown error'}`;
        }
        this.messageTimestamp = Date.now();
        this.requestUpdate();
    }

    async handleModelInput(e) {
        const modelName = e.target.value.trim();
        this.selectedLlmModel = modelName;
        this.clearMessages();

        // Save to user history if it's a valid model name
        if (modelName && modelName.length > 2) {
            this.saveToUserHistory(modelName);
        }

        this.requestUpdate();
    }

    async handleModelKeyPress(e) {
        if (e.key === 'Enter' && this.selectedLlmModel?.trim()) {
            e.preventDefault();
            console.log(`[ApiKeyHeader] Enter pressed, installing model: ${this.selectedLlmModel}`);

            // Check if Ollama is ready first
            const ollamaReady = await this.ensureOllamaReady();
            if (!ollamaReady) {
                this.llmError = '*Failed to setup Ollama';
                this.messageTimestamp = Date.now();
                this.requestUpdate();
                return;
            }

            // Install the model
            await this.installModel(this.selectedLlmModel);
        }
    }

    loadUserModelHistory() {
        try {
            const saved = localStorage.getItem('ollama-model-history');
            if (saved) {
                this.userModelHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to load model history:', error);
            this.userModelHistory = [];
        }
    }

    saveToUserHistory(modelName) {
        if (!modelName || !modelName.trim()) return;

        // Remove if already exists (to move to front)
        this.userModelHistory = this.userModelHistory.filter(m => m !== modelName);

        // Add to front
        this.userModelHistory.unshift(modelName);

        // Keep only last 20 entries
        this.userModelHistory = this.userModelHistory.slice(0, 20);

        // Save to localStorage
        try {
            localStorage.setItem('ollama-model-history', JSON.stringify(this.userModelHistory));
        } catch (error) {
            console.error('[ApiKeyHeader] Failed to save model history:', error);
        }
    }

    getCombinedModelSuggestions() {
        const combined = [];

        // Add installed models first (from Ollama CLI)
        for (const model of this.modelSuggestions) {
            combined.push({
                name: model.name,
                status: 'installed',
                size: model.size || 'Unknown',
                source: 'installed',
            });
        }

        // Add user history models that aren't already installed
        const installedNames = this.modelSuggestions.map(m => m.name);
        for (const modelName of this.userModelHistory) {
            if (!installedNames.includes(modelName)) {
                combined.push({
                    name: modelName,
                    status: 'history',
                    size: 'Unknown',
                    source: 'history',
                });
            }
        }

        return combined;
    }

    async installModel(modelName) {
        if (!modelName?.trim()) {
            throw new Error('Invalid model name');
        }

        this.installingModel = modelName;
        this.installProgress = 0;
        this.clearMessages();
        this.requestUpdate();

        if (!window.api?.apiKeyHeader) return;
        let progressHandler = null;

        try {
            console.log(`[ApiKeyHeader] Installing model via Ollama REST API: ${modelName}`);

            // Create robust progress handler with timeout protection
            progressHandler = (event, data) => {
                if (data.service === 'ollama' && data.model === modelName && !this._isOperationCancelled(modelName)) {
                    const progress = Math.round(Math.max(0, Math.min(100, data.progress || 0)));

                    if (progress !== this.installProgress) {
                        this.installProgress = progress;
                        console.log(`[ApiKeyHeader] API Progress: ${progress}% for ${modelName} (${data.status || 'downloading'})`);
                        this.requestUpdate();
                    }
                }
            };

            // Set up progress tracking - 통합 LocalAI 이벤트 사용
            window.api.apiKeyHeader.onLocalAIProgress(progressHandler);

            // Execute the model pull with timeout
            const installPromise = window.api.apiKeyHeader.pullOllamaModel(modelName);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Installation timeout after 10 minutes')), 600000));

            const result = await Promise.race([installPromise, timeoutPromise]);

            if (result.success) {
                console.log(`[ApiKeyHeader] Model ${modelName} installed successfully via API`);
                this.installProgress = 100;
                this.requestUpdate();

                // Brief pause to show completion
                await new Promise(resolve => setTimeout(resolve, 300));

                // Refresh status and show success
                await this.refreshOllamaStatus();
                this.successMessage = `✓ ${modelName} ready`;
                this.messageTimestamp = Date.now();
            } else {
                throw new Error(result.error || 'Installation failed');
            }
        } catch (error) {
            console.error(`[ApiKeyHeader] Model installation failed:`, error);
            this.llmError = `*Failed: ${error.message}`;
            this.messageTimestamp = Date.now();
        } finally {
            // Comprehensive cleanup
            if (progressHandler) {
                window.api.apiKeyHeader.removeOnLocalAIProgress(progressHandler);
            }

            this.installingModel = null;
            this.installProgress = 0;
            this.requestUpdate();
        }
    }

    _isOperationCancelled(modelName) {
        return !this.installingModel || this.installingModel !== modelName;
    }

    async downloadWhisperModel(modelId) {
        if (!modelId?.trim()) {
            console.warn('[ApiKeyHeader] Invalid Whisper model ID');
            return;
        }

        console.log(`[ApiKeyHeader] Starting Whisper model download: ${modelId}`);

        // Mark as installing
        this.whisperInstallingModels = { ...this.whisperInstallingModels, [modelId]: 0 };
        this.clearMessages();
        this.requestUpdate();

        if (!window.api?.apiKeyHeader) return;
        let progressHandler = null;

        try {
            // Set up robust progress listener - 통합 LocalAI 이벤트 사용
            progressHandler = (event, data) => {
                if (data.service === 'whisper' && data.model === modelId) {
                    const cleanProgress = Math.round(Math.max(0, Math.min(100, data.progress || 0)));
                    this.whisperInstallingModels = { ...this.whisperInstallingModels, [modelId]: cleanProgress };
                    console.log(`[ApiKeyHeader] Whisper download progress: ${cleanProgress}% for ${modelId}`);
                    this.requestUpdate();
                }
            };

            window.api.apiKeyHeader.onLocalAIProgress(progressHandler);

            // Start download with timeout protection
            const downloadPromise = window.api.apiKeyHeader.downloadWhisperModel(modelId);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout after 10 minutes')), 600000));

            const result = await Promise.race([downloadPromise, timeoutPromise]);

            if (result?.success) {
                this.successMessage = `✓ ${modelId} downloaded successfully`;
                this.messageTimestamp = Date.now();
                console.log(`[ApiKeyHeader] Whisper model ${modelId} downloaded successfully`);

                // Auto-select the downloaded model
                this.selectedSttModel = modelId;
            } else {
                this.sttError = `*Failed to download ${modelId}: ${result?.error || 'Unknown error'}`;
                this.messageTimestamp = Date.now();
                console.error(`[ApiKeyHeader] Whisper download failed:`, result?.error);
            }
        } catch (error) {
            console.error(`[ApiKeyHeader] Error downloading Whisper model ${modelId}:`, error);
            this.sttError = `*Error downloading ${modelId}: ${error.message}`;
            this.messageTimestamp = Date.now();
        } finally {
            // Cleanup
            if (progressHandler) {
                window.api.apiKeyHeader.removeOnLocalAIProgress(progressHandler);
            }
            delete this.whisperInstallingModels[modelId];
            this.requestUpdate();
        }
    }

    handlePaste(e) {
        e.preventDefault();
        this.clearMessages();
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

    //////// after_modelStateService ////////
    async handleSttModelChange(e) {
        const modelId = e.target.value;
        this.selectedSttModel = modelId;

        if (modelId && this.sttProvider === 'whisper') {
            // Check if model needs to be downloaded
            const isInstalling = this.whisperInstallingModels[modelId] !== undefined;
            if (!isInstalling) {
                console.log(`[ApiKeyHeader] Auto-installing Whisper model: ${modelId}`);
                await this.downloadWhisperModel(modelId);
            }
        }

        this.requestUpdate();
    }

    async handleSubmit() {
        console.log('[ApiKeyHeader] handleSubmit: Submitting...');

        this.isLoading = true;
        this.clearMessages();
        this.requestUpdate();

        if (!window.api?.apiKeyHeader) {
            this.isLoading = false;
            this.llmError = '*API bridge not available';
            this.requestUpdate();
            return;
        }

        try {
            // Handle LLM provider
            let llmResult;
            if (this.llmProvider === 'ollama') {
                // For Ollama ensure it's ready and validate model selection
                if (!this.selectedLlmModel?.trim()) {
                    throw new Error('Please enter an Ollama model name');
                }

                const ollamaReady = await this.ensureOllamaReady();
                if (!ollamaReady) {
                    throw new Error('Failed to setup Ollama');
                }

                // Check if model is installed, if not install it
                const selectedModel = this.getCombinedModelSuggestions().find(m => m.name === this.selectedLlmModel);
                if (!selectedModel || selectedModel.status !== 'installed') {
                    console.log(`[ApiKeyHeader] Installing model ${this.selectedLlmModel}...`);
                    await this.installModel(this.selectedLlmModel);
                }

                // Validate Ollama is working
                llmResult = await window.api.apiKeyHeader.validateKey({
                    provider: 'ollama',
                    key: 'local',
                });

                if (llmResult.success) {
                    // Set the selected model
                    await window.api.apiKeyHeader.setSelectedModel({
                        type: 'llm',
                        modelId: this.selectedLlmModel,
                    });
                }
            } else {
                // For other providers, validate API key
                if (!this.llmApiKey.trim()) {
                    throw new Error('Please enter LLM API key');
                }

                llmResult = await window.api.apiKeyHeader.validateKey({
                    provider: this.llmProvider,
                    key: this.llmApiKey.trim(),
                });

                if (llmResult.success) {
                    const config = await window.api.apiKeyHeader.getProviderConfig();
                    const providerConfig = config[this.llmProvider];
                    if (providerConfig && providerConfig.llmModels.length > 0) {
                        await window.api.apiKeyHeader.setSelectedModel({
                            type: 'llm',
                            modelId: providerConfig.llmModels[0].id,
                        });
                    }
                }
            }

            // Handle STT provider
            let sttResult;
            if (this.sttProvider === 'ollama') {
                // Ollama doesn't support STT yet, so skip or use same as LLM validation
                sttResult = { success: true };
            } else if (this.sttProvider === 'whisper') {
                // For Whisper, just validate it's enabled (model download already handled in handleSttModelChange)
                sttResult = await window.api.apiKeyHeader.validateKey({
                    provider: 'whisper',
                    key: 'local',
                });

                if (sttResult.success && this.selectedSttModel) {
                    // Set the selected model
                    await window.api.apiKeyHeader.setSelectedModel({
                        type: 'stt',
                        modelId: this.selectedSttModel,
                    });
                }
            } else {
                // For other providers, validate API key
                if (!this.sttApiKey.trim()) {
                    throw new Error('Please enter STT API key');
                }

                sttResult = await window.api.apiKeyHeader.validateKey({
                    provider: this.sttProvider,
                    key: this.sttApiKey.trim(),
                });

                if (sttResult.success) {
                    const config = await window.api.apiKeyHeader.getProviderConfig();
                    const providerConfig = config[this.sttProvider];
                    if (providerConfig && providerConfig.sttModels.length > 0) {
                        await window.api.apiKeyHeader.setSelectedModel({
                            type: 'stt',
                            modelId: providerConfig.sttModels[0].id,
                        });
                    }
                }
            }

            if (llmResult.success && sttResult.success) {
                console.log('[ApiKeyHeader] handleSubmit: Validation successful.');
                
                // Force refresh the model state to ensure areProvidersConfigured returns true
                setTimeout(async () => {
                    const isConfigured = await window.api.apiKeyHeader.areProvidersConfigured();
                    console.log('[ApiKeyHeader] Post-validation providers configured check:', isConfigured);
                    
                    if (isConfigured) {
                        this.startSlideOutAnimation();
                    } else {
                        console.error('[ApiKeyHeader] Providers still not configured after successful validation');
                        this.llmError = '*Configuration error. Please try again.';
                        this.isLoading = false;
                        this.requestUpdate();
                    }
                }, 100);
            } else {
                this.llmError = !llmResult.success ? `*${llmResult.error || 'Invalid API Key'}` : '';
                this.sttError = !sttResult.success ? `*${sttResult.error || 'Invalid'}` : '';
                this.errorMessage = ''; // Do not use the general error message for this
                this.messageTimestamp = Date.now();
            }
        } catch (error) {
            console.error('[ApiKeyHeader] handleSubmit: Error:', error);
            this.llmError = `*${error.message}`;
            this.messageTimestamp = Date.now();
        }

        this.isLoading = false;
        this.requestUpdate();
    }
    //////// after_modelStateService ////////


    ////TODO: 뭔가 넘어가는 애니메이션 로직에 문제가 있음
    startSlideOutAnimation() {
        console.log('[ApiKeyHeader] startSlideOutAnimation: Starting slide out animation.');
        this.classList.add('sliding-out');
        
        // Fallback: if animation doesn't trigger animationend event, force transition
        setTimeout(() => {
            if (this.classList.contains('sliding-out')) {
                console.log('[ApiKeyHeader] Animation fallback triggered - forcing transition');
                this.handleAnimationEnd({ target: this, animationName: 'slideOut' });
            }
        }, 1); // Wait a bit longer than animation duration
    }

    handleClose() {
        if (window.api?.common) {
            window.api.common.quitApplication();
        }
    }

    //////// after_modelStateService ////////
    handleAnimationEnd(e) {
        if (e.target !== this || !this.classList.contains('sliding-out')) return;
        this.classList.remove('sliding-out');
        this.classList.add('hidden');

        console.log('[ApiKeyHeader] handleAnimationEnd: Animation completed, transitioning to next state...');

        if (!window.api?.common) {
            console.error('[ApiKeyHeader] handleAnimationEnd: window.api.common not available');
            return;
        }

        if (!this.stateUpdateCallback) {
            console.error('[ApiKeyHeader] handleAnimationEnd: stateUpdateCallback not set! This will prevent transition to main window.');
            return;
        }

        window.api.common
            .getCurrentUser()
            .then(userState => {
                console.log('[ApiKeyHeader] handleAnimationEnd: User state retrieved:', userState);

                // Additional validation for local providers
                return window.api.apiKeyHeader.areProvidersConfigured().then(isConfigured => {
                    console.log('[ApiKeyHeader] handleAnimationEnd: Providers configured check:', isConfigured);

                    if (!isConfigured) {
                        console.warn('[ApiKeyHeader] handleAnimationEnd: Providers still not configured, may return to ApiKey screen');
                    }

                    // Call the state update callback
                    this.stateUpdateCallback(userState);
                });
            })
            .catch(error => {
                console.error('[ApiKeyHeader] handleAnimationEnd: Error during state transition:', error);

                // Fallback: try to call callback with minimal state
                if (this.stateUpdateCallback) {
                    console.log('[ApiKeyHeader] handleAnimationEnd: Attempting fallback state transition...');
                    this.stateUpdateCallback({ isLoggedIn: false });
                }
            });
    }
    //////// after_modelStateService ////////

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('animationend', this.handleAnimationEnd);
    }

    handleMessageFadeEnd(e) {
        if (e.animationName === 'fadeOut') {
            // Clear the message that finished fading
            if (e.target.classList.contains('error-message')) {
                this.errorMessage = '';
            } else if (e.target.classList.contains('success-message')) {
                this.successMessage = '';
            }
            this.messageTimestamp = 0;
            this.requestUpdate();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);

        // Professional cleanup of all resources
        this._performCompleteCleanup();
    }

    _performCompleteCleanup() {
        console.log('[ApiKeyHeader] Performing complete cleanup');

        // Stop health monitoring
        this._stopHealthMonitoring();

        // Cancel all active operations
        this._cancelAllActiveOperations();

        // Cancel any ongoing installations when component is destroyed
        if (this.installingModel) {
            this.progressTracker.cancelInstallation(this.installingModel);
        }

        // Cleanup event listeners
        if (window.api?.apiKeyHeader) {
            window.api.apiKeyHeader.removeAllListeners();
        }

        // Cancel any ongoing downloads
        const downloadingModels = Object.keys(this.whisperInstallingModels);
        if (downloadingModels.length > 0) {
            console.log(`[ApiKeyHeader] Cancelling ${downloadingModels.length} ongoing Whisper downloads`);
            downloadingModels.forEach(modelId => {
                delete this.whisperInstallingModels[modelId];
            });
        }

        // Reset state
        this.connectionState = 'disconnected';
        this.retryCount = 0;

        console.log('[ApiKeyHeader] Cleanup completed');
    }

    /**
     * State machine-based Ollama UI rendering
     */
    _renderOllamaStateUI() {
        const state = this._getOllamaUIState();

        switch (state.type) {
            case 'connecting':
                return this._renderConnectingState(state);
            case 'install_required':
                return this._renderInstallRequiredState();
            case 'start_required':
                return this._renderStartRequiredState();
            case 'ready':
                return this._renderReadyState();
            case 'failed':
                return this._renderFailedState(state);
            case 'installing':
                return this._renderInstallingState(state);
            default:
                return this._renderUnknownState();
        }
    }

    _getOllamaUIState() {
        // State determination logic
        if (this.connectionState === 'connecting') {
            return { type: 'connecting', message: this.installingModel || 'Connecting to Ollama...' };
        }

        if (this.connectionState === 'failed') {
            return { type: 'failed', message: this.errorMessage };
        }

        if (this.installingModel && this.installingModel.includes('Ollama')) {
            return { type: 'installing', progress: this.installProgress };
        }

        if (!this.ollamaStatus.installed) {
            return { type: 'install_required' };
        }

        if (!this.ollamaStatus.running) {
            return { type: 'start_required' };
        }

        return { type: 'ready' };
    }

    _renderConnectingState(state) {
        return html`
            <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                <div style="height: 1px; background: rgba(255,255,255,0.3); border-radius: 0.5px; overflow: hidden; flex: 1;">
                    <div style="height: 100%; background: rgba(0,122,255,1); width: ${this.installProgress}%; transition: width 0.1s ease;"></div>
                </div>
                <div style="font-size: 8px; color: rgba(255,255,255,0.8); font-weight: 600; min-width: 24px; text-align: right;">
                    ${this.installProgress}%
                </div>
            </div>
        `;
    }

    _renderInstallRequiredState() {
        return html` <button class="ollama-action-button install" @click=${this.ensureOllamaReadyWithUI}>Install Ollama</button> `;
    }

    _renderStartRequiredState() {
        return html` <button class="ollama-action-button start" @click=${this.ensureOllamaReadyWithUI}>Start Ollama Service</button> `;
    }

    _renderReadyState() {
        return html`
            <!-- Model Input with Autocomplete -->
            <input
                type="text"
                class="api-input"
                placeholder="Model name (press Enter to install)"
                .value=${this.selectedLlmModel}
                @input=${this.handleModelInput}
                @keypress=${this.handleModelKeyPress}
                list="model-suggestions"
                ?disabled=${this.isLoading || this.installingModel}
                style="text-align: left; padding-left: 12px;"
            />
            <datalist id="model-suggestions">
                ${this.getCombinedModelSuggestions().map(
                    model => html`
                        <option value=${model.name}>
                            ${model.name} ${model.status === 'installed' ? '✓ Installed' : model.status === 'history' ? '📝 Recent' : '- Available'}
                        </option>
                    `
                )}
            </datalist>

            <!-- Show model status -->
            ${this.renderModelStatus()}
            ${this.installingModel && !this.installingModel.includes('Ollama')
                ? html`
                      <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                          <div style="height: 1px; background: rgba(255,255,255,0.3); border-radius: 0.5px; overflow: hidden; flex: 1;">
                              <div
                                  style="height: 100%; background: rgba(0,122,255,1); width: ${this.installProgress}%; transition: width 0.1s ease;"
                              ></div>
                          </div>
                          <div style="font-size: 8px; color: rgba(255,255,255,0.8); font-weight: 600; min-width: 24px; text-align: right;">
                              ${this.installProgress}%
                          </div>
                      </div>
                  `
                : ''}
        `;
    }

    _renderFailedState(state) {
        return html`
            <div style="margin-top: 6px; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: rgba(239,68,68,0.8); margin-bottom: 4px; text-align: center;">Connection failed</div>
                <div style="font-size: 10px; color: rgba(239,68,68,0.6); text-align: center; margin-bottom: 6px;">
                    ${state.message || 'Unknown error'}
                </div>
                <button
                    class="action-button"
                    style="width: 100%; height: 28px; font-size: 10px; background: rgba(239,68,68,0.2);"
                    @click=${() => this._initializeOllamaConnection()}
                >
                    Retry Connection
                </button>
            </div>
        `;
    }

    _renderInstallingState(state) {
        return html`
            <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                <div style="height: 1px; background: rgba(255,255,255,0.3); border-radius: 0.5px; overflow: hidden; flex: 1;">
                    <div style="height: 100%; background: rgba(0,122,255,1); width: ${state.progress}%; transition: width 0.1s ease;"></div>
                </div>
                <div style="font-size: 8px; color: rgba(255,255,255,0.8); font-weight: 600; min-width: 24px; text-align: right;">
                    ${state.progress}%
                </div>
            </div>
        `;
    }

    _renderUnknownState() {
        return html`
            <div style="margin-top: 6px; padding: 8px; background: rgba(255,200,0,0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: rgba(255,200,0,0.8); text-align: center;">Unknown state - Please refresh</div>
            </div>
        `;
    }

    renderModelStatus() {
        return '';
    }

    shouldFadeMessage(type) {
        const hasMessage = type === 'error' ? this.errorMessage : this.successMessage;
        return hasMessage && this.messageTimestamp > 0 && Date.now() - this.messageTimestamp > 100;
    }

    openPrivacyPolicy() {
        console.log('🔊 openPrivacyPolicy ApiKeyHeader');
        if (window.api?.common) {
            window.api.common.openExternal('https://pickle.com/privacy-policy');
        }
    }

    render() {
        const llmNeedsApiKey = this.llmProvider !== 'ollama' && this.llmProvider !== 'whisper';
        const sttNeedsApiKey = this.sttProvider !== 'ollama' && this.sttProvider !== 'whisper';
        const llmNeedsModel = this.llmProvider === 'ollama';
        const sttNeedsModel = this.sttProvider === 'whisper';

        const isButtonDisabled =
            this.isLoading ||
            this.installingModel ||
            Object.keys(this.whisperInstallingModels).length > 0 ||
            (llmNeedsApiKey && !this.llmApiKey.trim()) ||
            (sttNeedsApiKey && !this.sttApiKey.trim()) ||
            (llmNeedsModel && !this.selectedLlmModel?.trim()) ||
            (sttNeedsModel && !this.selectedSttModel);

        const llmProviderName = this.providers.llm.find(p => p.id === this.llmProvider)?.name || this.llmProvider;

        return html`
            <div class="container">
                <button class="close-button" @click=${this.handleClose}>×</button>
                <div class="header">
                    <div class="back-button" @click=${this.handleBack}>
                        <i class="arrow-icon-left"></i>
                        <div class="back-button-text">Back</div>
                    </div>
                    <div class="title">Use Personal API keys</div>
                </div>

                <!-- LLM Section -->
                <div class="section">
                    <div class="row">
                        <div class="label">1. Select LLM Provider</div>
                        <div class="provider-selector">
                            ${this.providers.llm.map(
                                p => html`
                                    <button
                                        class="provider-button"
                                        data-status=${this.llmProvider === p.id ? 'active' : 'default'}
                                        @click=${e => this.handleLlmProviderChange(e, p.id)}
                                    >
                                        ${p.name}
                                    </button>
                                `
                            )}
                        </div>
                    </div>
                    <div class="row">
                        <div class="label">2. Enter API Key</div>
                        ${this.llmProvider === 'ollama'
                            ? this._renderOllamaStateUI()
                            : html`
                                  <div class="input-wrapper">
                                      <input
                                          type="password"
                                          class="api-input ${this.llmError ? 'invalid' : ''}"
                                          placeholder="Enter your ${llmProviderName} API key"
                                          .value=${this.llmApiKey}
                                          @input=${e => {
                                              this.llmApiKey = e.target.value;
                                              this.llmError = '';
                                          }}
                                          ?disabled=${this.isLoading}
                                      />
                                      ${this.llmError ? html`<div class="inline-error-message">${this.llmError}</div>` : ''}
                                  </div>
                              `}
                    </div>
                </div>

                <!-- STT Section -->
                <div class="section">
                    <div class="row">
                        <div class="label">3. Select STT Provider</div>
                        <div class="provider-selector">
                            ${this.providers.stt.map(
                                p => html`
                                    <button
                                        class="provider-button"
                                        data-status=${this.sttProvider === p.id ? 'active' : 'default'}
                                        @click=${e => this.handleSttProviderChange(e, p.id)}
                                    >
                                        ${p.name}
                                    </button>
                                `
                            )}
                        </div>
                    </div>
                    <div class="row">
                        <div class="label">4. Enter STT API Key</div>
                        ${this.sttProvider === 'ollama'
                            ? html`
                                  <div class="api-input" style="background: transparent; border: none; text-align: right; color: #a0a0a0;">
                                      STT not supported by Ollama
                                  </div>
                              `
                            : this.sttProvider === 'whisper'
                              ? html`
                                    <div class="input-wrapper">
                                        <select
                                            class="api-input ${this.sttError ? 'invalid' : ''}"
                                            .value=${this.selectedSttModel || ''}
                                            @change=${e => {
                                                this.handleSttModelChange(e);
                                                this.sttError = '';
                                            }}
                                            ?disabled=${this.isLoading}
                                        >
                                            <option value="">Select a model...</option>
                                            ${[
                                                { id: 'whisper-tiny', name: 'Whisper Tiny (39M)' },
                                                { id: 'whisper-base', name: 'Whisper Base (74M)' },
                                                { id: 'whisper-small', name: 'Whisper Small (244M)' },
                                                { id: 'whisper-medium', name: 'Whisper Medium (769M)' },
                                            ].map(model => html` <option value="${model.id}">${model.name}</option> `)}
                                        </select>
                                        ${this.sttError ? html`<div class="inline-error-message">${this.sttError}</div>` : ''}
                                    </div>
                                `
                              : html`
                                    <div class="input-wrapper">
                                        <input
                                            type="password"
                                            class="api-input ${this.sttError ? 'invalid' : ''}"
                                            placeholder="Enter your STT API key"
                                            .value=${this.sttApiKey}
                                            @input=${e => {
                                                this.sttApiKey = e.target.value;
                                                this.sttError = '';
                                            }}
                                            ?disabled=${this.isLoading}
                                        />
                                        ${this.sttError ? html`<div class="inline-error-message">${this.sttError}</div>` : ''}
                                    </div>
                                `}
                    </div>
                </div>
                <div class="confirm-button-container">
                    <button class="confirm-button" @click=${this.handleSubmit} ?disabled=${isButtonDisabled}>
                        ${this.isLoading
                            ? 'Setting up...'
                            : this.installingModel
                              ? `Installing ${this.installingModel}...`
                              : Object.keys(this.whisperInstallingModels).length > 0
                                ? `Downloading...`
                                : 'Confirm'}
                    </button>
                </div>

                <div class="footer">
                    Get your API key from: OpenAI | Google | Anthropic
                    <br />
                    Glass does not collect your personal data —
                    <span class="footer-link" @click=${this.openPrivacyPolicy}>See details</span>
                </div>

                <div class="error-message ${this.shouldFadeMessage('error') ? 'message-fade-out' : ''}" @animationend=${this.handleMessageFadeEnd}>
                    ${this.errorMessage}
                </div>
                <div
                    class="success-message ${this.shouldFadeMessage('success') ? 'message-fade-out' : ''}"
                    @animationend=${this.handleMessageFadeEnd}
                >
                    ${this.successMessage}
                </div>
            </div>
        `;
    }
}

customElements.define('apikey-header', ApiKeyHeader);
