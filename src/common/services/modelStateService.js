const Store = require('electron-store');
const fetch = require('node-fetch');
const { ipcMain, webContents } = require('electron');
const { PROVIDERS } = require('../ai/factory');
const encryptionService = require('./encryptionService');

class ModelStateService {
    constructor(authService) {
        this.authService = authService;
        this.store = new Store({ name: 'pickle-glass-model-state' });
        this.state = {};
    }

    async initialize() {
        await this._loadStateForCurrentUser();

        this.setupIpcHandlers();
        console.log('[ModelStateService] Initialized.');
    }

    _logCurrentSelection() {
        const llmModel = this.state.selectedModels.llm;
        const sttModel = this.state.selectedModels.stt;
        const llmProvider = this.getProviderForModel('llm', llmModel) || 'None';
        const sttProvider = this.getProviderForModel('stt', sttModel) || 'None';
    
        console.log(`[ModelStateService] Current Selection -> LLM: ${llmModel || 'None'} (Provider: ${llmProvider}), STT: ${sttModel || 'None'} (Provider: ${sttProvider})`);
    }

    _autoSelectAvailableModels() {
        console.log('[ModelStateService] Running auto-selection for models...');
        const types = ['llm', 'stt'];

        types.forEach(type => {
            const currentModelId = this.state.selectedModels[type];
            let isCurrentModelValid = false;

            if (currentModelId) {
                const provider = this.getProviderForModel(type, currentModelId);
                const apiKey = this.getApiKey(provider);
                // For Ollama, 'local' is a valid API key
                if (provider && (apiKey || (provider === 'ollama' && apiKey === 'local'))) {
                    isCurrentModelValid = true;
                }
            }

            if (!isCurrentModelValid) {
                console.log(`[ModelStateService] No valid ${type.toUpperCase()} model selected. Finding an alternative...`);
                const availableModels = this.getAvailableModels(type);
                if (availableModels.length > 0) {
                    // Prefer API providers over local providers for auto-selection
                    const apiModel = availableModels.find(model => {
                        const provider = this.getProviderForModel(type, model.id);
                        return provider && provider !== 'ollama' && provider !== 'whisper';
                    });
                    
                    const selectedModel = apiModel || availableModels[0];
                    this.state.selectedModels[type] = selectedModel.id;
                    console.log(`[ModelStateService] Auto-selected ${type.toUpperCase()} model: ${selectedModel.id} (preferred: ${apiModel ? 'API' : 'local'})`);
                } else {
                    this.state.selectedModels[type] = null;
                }
            }
        });
    }

    async _loadStateForCurrentUser() {
        const userId = this.authService.getCurrentUserId();
        
        // Initialize encryption service for current user
        await encryptionService.initializeKey(userId);
        
        const initialApiKeys = Object.keys(PROVIDERS).reduce((acc, key) => {
            acc[key] = null;
            return acc;
        }, {});

        const defaultState = {
            apiKeys: initialApiKeys,
            selectedModels: { llm: null, stt: null },
        };
        this.state = this.store.get(`users.${userId}`, defaultState);
        console.log(`[ModelStateService] State loaded for user: ${userId}`);
        
        for (const p of Object.keys(PROVIDERS)) {
            if (!(p in this.state.apiKeys)) {
                this.state.apiKeys[p] = null;
            } else if (this.state.apiKeys[p] && p !== 'ollama' && p !== 'whisper') {
                try {
                    this.state.apiKeys[p] = encryptionService.decrypt(this.state.apiKeys[p]);
                } catch (error) {
                    console.error(`[ModelStateService] Failed to decrypt API key for ${p}, resetting`);
                    this.state.apiKeys[p] = null;
                }
            }
        }
        
        this._autoSelectAvailableModels();
        this._saveState();
        this._logCurrentSelection();
    }


    _saveState() {
        const userId = this.authService.getCurrentUserId();
        const stateToSave = {
            ...this.state,
            apiKeys: { ...this.state.apiKeys }
        };
        
        for (const [provider, key] of Object.entries(stateToSave.apiKeys)) {
            if (key && provider !== 'ollama' && provider !== 'whisper') {
                try {
                    stateToSave.apiKeys[provider] = encryptionService.encrypt(key);
                } catch (error) {
                    console.error(`[ModelStateService] Failed to encrypt API key for ${provider}`);
                    stateToSave.apiKeys[provider] = null;
                }
            }
        }
        
        this.store.set(`users.${userId}`, stateToSave);
        console.log(`[ModelStateService] State saved for user: ${userId}`);
        this._logCurrentSelection();
    }

    async validateApiKey(provider, key) {
        if (!key || key.trim() === '') {
            return { success: false, error: 'API key cannot be empty.' };
        }

        let validationUrl, headers;
        const body = undefined;

        switch (provider) {
            case 'ollama':
                // Ollama doesn't need API key validation
                // Just check if the service is running
                try {
                    const response = await fetch('http://localhost:11434/api/tags');
                    if (response.ok) {
                        console.log(`[ModelStateService] Ollama service is accessible.`);
                        this.setApiKey(provider, 'local'); // Use 'local' as a placeholder
                        return { success: true };
                    } else {
                        return { success: false, error: 'Ollama service is not running. Please start Ollama first.' };
                    }
                } catch (error) {
                    return { success: false, error: 'Cannot connect to Ollama. Please ensure Ollama is installed and running.' };
                }
            case 'whisper':
                // Whisper is a local service, no API key validation needed
                console.log(`[ModelStateService] Whisper is a local service.`);
                this.setApiKey(provider, 'local'); // Use 'local' as a placeholder
                return { success: true };
            case 'openai':
                validationUrl = 'https://api.openai.com/v1/models';
                headers = { 'Authorization': `Bearer ${key}` };
                break;
            case 'gemini':
                validationUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
                headers = {};
                break;
            case 'anthropic': {
                if (!key.startsWith('sk-ant-')) {
                    throw new Error('Invalid Anthropic key format.');
                }
                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-3-haiku-20240307",
                        max_tokens: 1,
                        messages: [{ role: "user", content: "Hi" }],
                    }),
                });

                if (!response.ok && response.status !== 400) {
                        const errorData = await response.json().catch(() => ({}));
                        return { success: false, error: errorData.error?.message || `Validation failed with status: ${response.status}` };
                    }
                
                    console.log(`[ModelStateService] API key for ${provider} is valid.`);
                    this.setApiKey(provider, key);
                    return { success: true };
                }
            default:
                return { success: false, error: 'Unknown provider.' };
        }

        try {
            const response = await fetch(validationUrl, { headers, body });
            if (response.ok) {
                console.log(`[ModelStateService] API key for ${provider} is valid.`);
                this.setApiKey(provider, key);
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                console.log(`[ModelStateService] API key for ${provider} is invalid: ${message}`);
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[ModelStateService] Network error during ${provider} key validation:`, error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
    
    setFirebaseVirtualKey(virtualKey) {
        console.log(`[ModelStateService] Setting Firebase virtual key (for openai-glass).`);
        this.state.apiKeys['openai-glass'] = virtualKey;
        
        const llmModels = PROVIDERS['openai-glass']?.llmModels;
        const sttModels = PROVIDERS['openai-glass']?.sttModels;

        // When logging in with Pickle, prioritize Pickle's models over existing selections
        if (virtualKey && llmModels?.length > 0) {
            this.state.selectedModels.llm = llmModels[0].id;
            console.log(`[ModelStateService] Prioritized Pickle LLM model: ${llmModels[0].id}`);
        }
        if (virtualKey && sttModels?.length > 0) {
            this.state.selectedModels.stt = sttModels[0].id;
            console.log(`[ModelStateService] Prioritized Pickle STT model: ${sttModels[0].id}`);
        }
        
        // If logging out (virtualKey is null), run auto-selection to find alternatives
        if (!virtualKey) {
            this._autoSelectAvailableModels();
        }
        
        this._saveState();
        this._logCurrentSelection();
    }

    setApiKey(provider, key) {
        if (provider in this.state.apiKeys) {
            this.state.apiKeys[provider] = key;

            const llmModels = PROVIDERS[provider]?.llmModels;
            const sttModels = PROVIDERS[provider]?.sttModels;

            // Prioritize newly set API key provider over existing selections
            // Only for non-local providers or if no model is currently selected
            if (llmModels?.length > 0) {
                if (!this.state.selectedModels.llm || provider !== 'ollama') {
                    this.state.selectedModels.llm = llmModels[0].id;
                    console.log(`[ModelStateService] Selected LLM model from newly configured provider ${provider}: ${llmModels[0].id}`);
                }
            }
            if (sttModels?.length > 0) {
                if (!this.state.selectedModels.stt || provider !== 'whisper') {
                    this.state.selectedModels.stt = sttModels[0].id;
                    console.log(`[ModelStateService] Selected STT model from newly configured provider ${provider}: ${sttModels[0].id}`);
                }
            }
            this._saveState();
            this._logCurrentSelection();
            return true;
        }
        return false;
    }

    getApiKey(provider) {
        return this.state.apiKeys[provider] || null;
    }

    getAllApiKeys() {
        const { 'openai-glass': _, ...displayKeys } = this.state.apiKeys;
        return displayKeys;
    }

    removeApiKey(provider) {
        if (provider in this.state.apiKeys) {
            this.state.apiKeys[provider] = null;
            const llmProvider = this.getProviderForModel('llm', this.state.selectedModels.llm);
            if (llmProvider === provider) this.state.selectedModels.llm = null;

            const sttProvider = this.getProviderForModel('stt', this.state.selectedModels.stt);
            if (sttProvider === provider) this.state.selectedModels.stt = null;
            
            this._autoSelectAvailableModels();
            this._saveState();
            this._logCurrentSelection();
            return true;
        }
        return false;
    }

    getProviderForModel(type, modelId) {
        if (!modelId) return null;
        for (const providerId in PROVIDERS) {
            const models = type === 'llm' ? PROVIDERS[providerId].llmModels : PROVIDERS[providerId].sttModels;
            if (models.some(m => m.id === modelId)) {
                return providerId;
            }
        }
        
        // If no provider was found, assume it could be a custom Ollama model
        // if Ollama provider is configured (has a key).
        if (type === 'llm' && this.state.apiKeys['ollama']) {
            console.log(`[ModelStateService] Model '${modelId}' not found in PROVIDERS list, assuming it's a custom Ollama model.`);
            return 'ollama';
        }

        return null;
    }

    getCurrentProvider(type) {
        const selectedModel = this.state.selectedModels[type];
        return this.getProviderForModel(type, selectedModel);
    }

    isLoggedInWithFirebase() {
        return this.authService.getCurrentUser().isLoggedIn;
    }

    areProvidersConfigured() {
        if (this.isLoggedInWithFirebase()) return true;
        
        // LLM과 STT 모델을 제공하는 Provider 중 하나라도 API 키가 설정되었는지 확인
        const hasLlmKey = Object.entries(this.state.apiKeys).some(([provider, key]) => {
            if (provider === 'ollama') {
                // Ollama uses dynamic models, so just check if configured (has 'local' key)
                return key === 'local';
            }
            if (provider === 'whisper') {
                // Whisper doesn't support LLM
                return false;
            }
            return key && PROVIDERS[provider]?.llmModels.length > 0;
        });
        
        const hasSttKey = Object.entries(this.state.apiKeys).some(([provider, key]) => {
            if (provider === 'whisper') {
                // Whisper has static model list and supports STT
                return key === 'local' && PROVIDERS[provider]?.sttModels.length > 0;
            }
            if (provider === 'ollama') {
                // Ollama doesn't support STT yet
                return false;
            }
            return key && PROVIDERS[provider]?.sttModels.length > 0;
        });
        
        const result = hasLlmKey && hasSttKey;
        console.log(`[ModelStateService] areProvidersConfigured: LLM=${hasLlmKey}, STT=${hasSttKey}, result=${result}`);
        return result;
    }


    getAvailableModels(type) {
        const available = [];
        const modelList = type === 'llm' ? 'llmModels' : 'sttModels';

        Object.entries(this.state.apiKeys).forEach(([providerId, key]) => {
            if (key && PROVIDERS[providerId]?.[modelList]) {
                available.push(...PROVIDERS[providerId][modelList]);
            }
        });
        return [...new Map(available.map(item => [item.id, item])).values()];
    }
    
    getSelectedModels() {
        return this.state.selectedModels;
    }
    
    setSelectedModel(type, modelId) {
        const provider = this.getProviderForModel(type, modelId);
        if (provider && this.state.apiKeys[provider]) {
            const previousModel = this.state.selectedModels[type];
            this.state.selectedModels[type] = modelId;
            this._saveState();
            
            // Auto warm-up for Ollama LLM models when changed
            if (type === 'llm' && provider === 'ollama' && modelId !== previousModel) {
                this._autoWarmUpOllamaModel(modelId, previousModel);
            }
            
            return true;
        }
        return false;
    }

    /**
     * Auto warm-up Ollama model when LLM selection changes
     * @private
     * @param {string} newModelId - The newly selected model
     * @param {string} previousModelId - The previously selected model
     */
    async _autoWarmUpOllamaModel(newModelId, previousModelId) {
        try {
            console.log(`[ModelStateService] 🔥 LLM model changed: ${previousModelId || 'None'} → ${newModelId}, triggering warm-up`);
            
            // Get Ollama service if available
            const ollamaService = require('./ollamaService');
            if (!ollamaService) {
                console.log('[ModelStateService] OllamaService not available for auto warm-up');
                return;
            }

            // Delay warm-up slightly to allow UI to update first
            setTimeout(async () => {
                try {
                    console.log(`[ModelStateService] Starting background warm-up for: ${newModelId}`);
                    const success = await ollamaService.warmUpModel(newModelId);
                    
                    if (success) {
                        console.log(`[ModelStateService] ✅ Successfully warmed up model: ${newModelId}`);
                    } else {
                        console.log(`[ModelStateService] ⚠️ Failed to warm up model: ${newModelId}`);
                    }
                } catch (error) {
                    console.log(`[ModelStateService] 🚫 Error during auto warm-up for ${newModelId}:`, error.message);
                }
            }, 500); // 500ms delay
            
        } catch (error) {
            console.error('[ModelStateService] Error in auto warm-up setup:', error);
        }
    }

    /**
     * 
     * @param {('llm' | 'stt')} type
     * @returns {{provider: string, model: string, apiKey: string} | null}
     */
    getCurrentModelInfo(type) {
        this._logCurrentSelection();
        const model = this.state.selectedModels[type];
        if (!model) {
            return null; 
        }
        
        const provider = this.getProviderForModel(type, model);
        if (!provider) {
            return null;
        }

        const apiKey = this.getApiKey(provider);
        return { provider, model, apiKey };
    }
    
    setupIpcHandlers() {
        ipcMain.handle('model:validate-key', (e, { provider, key }) => this.validateApiKey(provider, key));
        ipcMain.handle('model:get-all-keys', () => this.getAllApiKeys());
        ipcMain.handle('model:set-api-key', (e, { provider, key }) => this.setApiKey(provider, key));
        ipcMain.handle('model:remove-api-key', (e, { provider }) => {
            const success = this.removeApiKey(provider);
            if (success) {
                const selectedModels = this.getSelectedModels();
                if (!selectedModels.llm || !selectedModels.stt) {
                    webContents.getAllWebContents().forEach(wc => {
                        wc.send('force-show-apikey-header');
                    });
                }
            }
            return success;
        });
        ipcMain.handle('model:get-selected-models', () => this.getSelectedModels());
        ipcMain.handle('model:set-selected-model', (e, { type, modelId }) => this.setSelectedModel(type, modelId));
        ipcMain.handle('model:get-available-models', (e, { type }) => this.getAvailableModels(type));
        ipcMain.handle('model:are-providers-configured', () => this.areProvidersConfigured());
        ipcMain.handle('model:get-current-model-info', (e, { type }) => this.getCurrentModelInfo(type));

        ipcMain.handle('model:get-provider-config', () => {
            const serializableProviders = {};
            for (const key in PROVIDERS) {
                const { handler, ...rest } = PROVIDERS[key];
                serializableProviders[key] = rest;
            }
            return serializableProviders;
        });
    }
}

module.exports = ModelStateService;