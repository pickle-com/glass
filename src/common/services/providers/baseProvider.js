/**
 * Base AI Provider Interface
 * All AI providers must implement these methods
 */
class BaseProvider {
    constructor(name, displayName) {
        this.name = name;
        this.displayName = displayName;
        this.apiKey = null;
        this.client = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the provider with API key
     * @param {string} apiKey - API key for the provider
     * @param {object} config - Additional configuration
     */
    async initialize(apiKey, config = {}) {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Create a chat completion
     * @param {Array} messages - Array of messages
     * @param {object} options - Options like model, temperature, etc.
     */
    async createChatCompletion(messages, options = {}) {
        throw new Error('createChatCompletion() must be implemented by provider');
    }

    /**
     * Create a streaming chat completion
     * @param {Array} messages - Array of messages
     * @param {object} options - Options including stream callback
     */
    async createStreamingChatCompletion(messages, options = {}) {
        throw new Error('createStreamingChatCompletion() must be implemented by provider');
    }

    /**
     * Connect to real-time session for speech-to-text
     * @param {object} config - STT configuration
     */
    async connectToRealtimeSession(config) {
        throw new Error('connectToRealtimeSession() must be implemented by provider');
    }

    /**
     * Validate API key
     * @param {string} apiKey - API key to validate
     */
    async validateApiKey(apiKey) {
        throw new Error('validateApiKey() must be implemented by provider');
    }

    /**
     * Get available models for this provider
     */
    getAvailableModels() {
        throw new Error('getAvailableModels() must be implemented by provider');
    }

    /**
     * Get provider display name
     */
    getDisplayName() {
        return this.displayName;
    }

    /**
     * Get provider name
     */
    getName() {
        return this.name;
    }

    /**
     * Check if provider is initialized
     */
    isReady() {
        return this.isInitialized && this.apiKey && this.client;
    }

    /**
     * Common method to format messages for different providers
     * @param {Array} messages - Array of messages
     */
    formatMessages(messages) {
        // Base implementation - providers can override
        return messages;
    }

    /**
     * Common method to handle image content
     * @param {string} base64Data - Base64 image data
     * @param {string} mimeType - MIME type of the image
     */
    formatImageContent(base64Data, mimeType = 'image/jpeg') {
        // Base implementation - providers can override
        return {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Data}` }
        };
    }
}

module.exports = { BaseProvider }; 