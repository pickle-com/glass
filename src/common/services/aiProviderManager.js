const { OpenAIProvider } = require('./providers/openaiProvider');
const { GeminiProvider } = require('./providers/geminiProvider');

/**
 * AI Provider Manager - Handles multiple AI providers (OpenAI, Gemini)
 */
class AIProviderManager {
    constructor() {
        this.providers = {
            openai: new OpenAIProvider(),
            gemini: new GeminiProvider()
        };
        this.currentProvider = 'openai'; // default
        this.currentApiKey = null;
    }

    /**
     * Set the current AI provider
     * @param {string} providerName - 'openai' or 'gemini'
     */
    setProvider(providerName) {
        if (!this.providers[providerName]) {
            throw new Error(`Provider ${providerName} not supported`);
        }
        
        const previousProvider = this.currentProvider;
        this.currentProvider = providerName;
        console.log(`[AIProviderManager] Switched to provider: ${providerName}`);
        
        // Re-initialize with current API key if available
        if (this.currentApiKey) {
            this.initialize(this.currentApiKey);
        }
        
        return previousProvider !== providerName;
    }

    /**
     * Get the current provider instance
     */
    getProvider() {
        return this.providers[this.currentProvider];
    }

    /**
     * Get current provider name
     */
    getCurrentProviderName() {
        return this.currentProvider;
    }

    /**
     * Get available providers
     */
    getAvailableProviders() {
        return Object.keys(this.providers).map(key => ({
            id: key,
            name: this.providers[key].getDisplayName(),
            capabilities: this.providers[key].getCapabilities ? this.providers[key].getCapabilities() : {}
        }));
    }

    /**
     * Initialize the current provider with API key
     * @param {string} apiKey - API key for the provider
     * @param {object} config - Additional configuration
     */
    async initialize(apiKey, config = {}) {
        this.currentApiKey = apiKey;
        const provider = this.getProvider();
        const success = await provider.initialize(apiKey, config);
        
        if (success) {
            console.log(`[AIProviderManager] ${provider.getDisplayName()} initialized successfully`);
        } else {
            console.error(`[AIProviderManager] Failed to initialize ${provider.getDisplayName()}`);
        }
        
        return success;
    }

    /**
     * Create a chat completion
     * @param {Array} messages - Array of messages
     * @param {object} options - Options like model, temperature, etc.
     */
    async createChatCompletion(messages, options = {}) {
        const provider = this.getProvider();
        return await provider.createChatCompletion(messages, options);
    }

    /**
     * Create a streaming chat completion
     * @param {Array} messages - Array of messages
     * @param {object} options - Options including stream callback
     */
    async createStreamingChatCompletion(messages, options = {}) {
        const provider = this.getProvider();
        return await provider.createStreamingChatCompletion(messages, options);
    }

    /**
     * Connect to real-time session for speech-to-text
     * @param {object} config - STT configuration
     */
    async connectToRealtimeSession(config) {
        const provider = this.getProvider();
        
        // Check if provider supports real-time
        if (provider.supportsRealtime && !provider.supportsRealtime()) {
            throw new Error(`${provider.getDisplayName()} does not support real-time transcription. Please switch to OpenAI for live features.`);
        }
        
        return await provider.connectToRealtimeSession(config);
    }

    /**
     * Validate API key for current provider
     * @param {string} apiKey - API key to validate
     */
    async validateApiKey(apiKey) {
        const provider = this.getProvider();
        return await provider.validateApiKey(apiKey);
    }

    /**
     * Get provider-specific models
     */
    getAvailableModels() {
        const provider = this.getProvider();
        return provider.getAvailableModels();
    }

    /**
     * Get provider display name
     */
    getProviderDisplayName() {
        const provider = this.getProvider();
        return provider.getDisplayName();
    }

    /**
     * Check if current provider is ready
     */
    isReady() {
        const provider = this.getProvider();
        return provider.isReady();
    }

    /**
     * Get provider capabilities
     */
    getCapabilities() {
        const provider = this.getProvider();
        return provider.getCapabilities ? provider.getCapabilities() : {};
    }

    /**
     * Check if current provider supports a specific feature
     * @param {string} feature - Feature name (e.g., 'realtime', 'vision', 'streaming')
     */
    supportsFeature(feature) {
        const capabilities = this.getCapabilities();
        return capabilities[feature] || false;
    }

    /**
     * Set provider from stored settings
     * @param {string} storedProvider - Provider name from settings
     */
    setProviderFromSettings(storedProvider) {
        if (storedProvider && this.providers[storedProvider]) {
            this.setProvider(storedProvider);
            return true;
        }
        return false;
    }

    /**
     * Get provider for storage in settings
     */
    getProviderForSettings() {
        return this.currentProvider;
    }
}

// Singleton instance
const aiProviderManager = new AIProviderManager();

module.exports = aiProviderManager; 