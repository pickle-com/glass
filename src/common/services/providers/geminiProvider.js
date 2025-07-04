const { BaseProvider } = require('./baseProvider');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini Provider Implementation
 */
class GeminiProvider extends BaseProvider {
    constructor() {
        super('gemini', 'Google Gemini');
        this.models = {
            chat: 'gemini-1.5-pro',
            vision: 'gemini-1.5-pro',
            fast: 'gemini-1.5-flash'
        };
    }

    async initialize(apiKey, config = {}) {
        try {
            this.apiKey = apiKey;
            this.client = new GoogleGenerativeAI(apiKey);
            this.isInitialized = true;
            console.log('[GeminiProvider] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[GeminiProvider] Initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async createChatCompletion(messages, options = {}) {
        if (!this.isReady()) {
            throw new Error('Gemini provider not initialized');
        }

        const model = options.model || this.models.chat;
        const temperature = options.temperature || 0.7;
        const maxTokens = options.maxTokens || 2048;

        const genModel = this.client.getGenerativeModel({ 
            model,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens
            }
        });

        const formattedMessages = this.formatMessages(messages);
        const parts = this.convertMessagesToGeminiParts(formattedMessages);

        const result = await genModel.generateContent(parts);
        const response = await result.response;

        return {
            content: response.text(),
            usage: {
                prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
                completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: response.usageMetadata?.totalTokenCount || 0
            },
            model: model
        };
    }

    async createStreamingChatCompletion(messages, options = {}) {
        if (!this.isReady()) {
            throw new Error('Gemini provider not initialized');
        }

        const model = options.model || this.models.chat;
        const temperature = options.temperature || 0.7;
        const maxTokens = options.maxTokens || 2048;
        const onChunk = options.onChunk || (() => {});

        const genModel = this.client.getGenerativeModel({ 
            model,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens
            }
        });

        const formattedMessages = this.formatMessages(messages);
        const parts = this.convertMessagesToGeminiParts(formattedMessages);

        const result = await genModel.generateContentStream(parts);
        
        let fullContent = '';
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullContent += chunkText;
                onChunk(chunkText, fullContent);
            }
        }

        return { content: fullContent };
    }

    async connectToRealtimeSession(config) {
        // Gemini doesn't currently support real-time WebSocket transcription
        // We'll throw an informative error
        throw new Error('Gemini does not currently support real-time speech-to-text. Please use OpenAI for live transcription features.');
    }

    async validateApiKey(apiKey) {
        try {
            const testClient = new GoogleGenerativeAI(apiKey);
            const model = testClient.getGenerativeModel({ model: this.models.fast });
            
            // Try a simple test request
            const result = await model.generateContent('Hello');
            const response = await result.response;
            
            if (response.text()) {
                console.log('[GeminiProvider] API key validation successful');
                return true;
            } else {
                console.log('[GeminiProvider] API key validation failed - no response');
                return false;
            }
        } catch (error) {
            console.error('[GeminiProvider] API key validation failed:', error);
            return false;
        }
    }

    getAvailableModels() {
        return {
            chat: [
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
            ],
            vision: [
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
            ]
        };
    }

    formatMessages(messages) {
        // Gemini requires different message formatting
        return messages;
    }

    formatImageContent(base64Data, mimeType = 'image/jpeg') {
        // Gemini format for inline images
        return {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };
    }

    /**
     * Convert OpenAI-style messages to Gemini parts format
     * @param {Array} messages - OpenAI format messages
     */
    convertMessagesToGeminiParts(messages) {
        const parts = [];
        
        for (const message of messages) {
            if (message.role === 'system') {
                // Gemini doesn't have system role, so we prepend system message as instruction
                parts.unshift({ text: `Instructions: ${message.content}\n\n` });
            } else if (message.role === 'user') {
                if (Array.isArray(message.content)) {
                    // Handle multimodal content (text + images)
                    for (const item of message.content) {
                        if (item.type === 'text') {
                            parts.push({ text: item.text });
                        } else if (item.type === 'image_url') {
                            // Extract base64 data from data URL
                            const base64Match = item.image_url.url.match(/data:([^;]+);base64,(.+)/);
                            if (base64Match) {
                                const mimeType = base64Match[1];
                                const data = base64Match[2];
                                parts.push(this.formatImageContent(data, mimeType));
                            }
                        }
                    }
                } else {
                    // Simple text content
                    parts.push({ text: message.content });
                }
            } else if (message.role === 'assistant') {
                // For conversation history
                parts.push({ text: `Assistant: ${message.content}` });
            }
        }
        
        return parts;
    }

    /**
     * Helper method to check if the provider supports real-time features
     */
    supportsRealtime() {
        return false;
    }

    /**
     * Get provider-specific capabilities
     */
    getCapabilities() {
        return {
            chat: true,
            vision: true,
            streaming: true,
            realtime: false,
            functions: true
        };
    }
}

module.exports = { GeminiProvider }; 