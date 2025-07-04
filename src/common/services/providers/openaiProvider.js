const { BaseProvider } = require('./baseProvider');
const OpenAI = require('openai');
const WebSocket = require('ws');

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider extends BaseProvider {
    constructor() {
        super('openai', 'OpenAI');
        this.models = {
            chat: 'gpt-4o',
            vision: 'gpt-4o',
            transcription: 'gpt-4o-mini-transcribe'
        };
    }

    async initialize(apiKey, config = {}) {
        try {
            this.apiKey = apiKey;
            this.client = new OpenAI({ apiKey });
            this.isInitialized = true;
            console.log('[OpenAIProvider] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[OpenAIProvider] Initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async createChatCompletion(messages, options = {}) {
        if (!this.isReady()) {
            throw new Error('OpenAI provider not initialized');
        }

        const model = options.model || this.models.chat;
        const temperature = options.temperature || 0.7;
        const maxTokens = options.maxTokens || 2048;

        const response = await this.client.chat.completions.create({
            model,
            messages: this.formatMessages(messages),
            temperature,
            max_tokens: maxTokens
        });

        return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model
        };
    }

    async createStreamingChatCompletion(messages, options = {}) {
        if (!this.isReady()) {
            throw new Error('OpenAI provider not initialized');
        }

        const model = options.model || this.models.chat;
        const temperature = options.temperature || 0.7;
        const maxTokens = options.maxTokens || 2048;
        const onChunk = options.onChunk || (() => {});

        const stream = await this.client.chat.completions.create({
            model,
            messages: this.formatMessages(messages),
            temperature,
            max_tokens: maxTokens,
            stream: true
        });

        let fullContent = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullContent += content;
                onChunk(content, fullContent);
            }
        }

        return { content: fullContent };
    }

    async connectToRealtimeSession(config) {
        if (!this.apiKey) {
            throw new Error('OpenAI provider not initialized');
        }

        const { keyType = 'apiKey', language = 'en', callbacks = {} } = config;

        const wsUrl = keyType === 'apiKey'
            ? 'wss://api.openai.com/v1/realtime?intent=transcription'
            : 'wss://api.portkey.ai/v1/realtime?intent=transcription';

        const headers = keyType === 'apiKey'
            ? {
                'Authorization': `Bearer ${this.apiKey}`,
                'OpenAI-Beta': 'realtime=v1',
            }
            : {
                'x-portkey-api-key': 'gRv2UGRMq6GGLJ8aVEB4e7adIewu',
                'x-portkey-virtual-key': this.apiKey,
                'OpenAI-Beta': 'realtime=v1',
            };

        const ws = new WebSocket(wsUrl, { headers });

        return new Promise((resolve, reject) => {
            ws.onopen = () => {
                console.log('[OpenAIProvider] WebSocket session opened');

                const sessionConfig = {
                    type: 'transcription_session.update',
                    session: {
                        input_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: this.models.transcription,
                            prompt: config.prompt || '',
                            language: language
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 50,
                            silence_duration_ms: 25,
                        },
                        input_audio_noise_reduction: {
                            type: 'near_field'
                        }
                    }
                };

                ws.send(JSON.stringify(sessionConfig));

                resolve({
                    sendRealtimeInput: (audioData) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            const message = {
                                type: 'input_audio_buffer.append',
                                audio: audioData
                            };
                            ws.send(JSON.stringify(message));
                        }
                    },
                    close: () => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'session.close' }));
                            ws.close(1000, 'Client initiated close.');
                        }
                    }
                });
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (callbacks.onmessage) {
                    callbacks.onmessage(message);
                }
            };

            ws.onerror = (error) => {
                console.error('[OpenAIProvider] WebSocket error:', error.message);
                if (callbacks.onerror) {
                    callbacks.onerror(error);
                }
                reject(error);
            };

            ws.onclose = (event) => {
                console.log(`[OpenAIProvider] WebSocket closed: ${event.code} ${event.reason}`);
                if (callbacks.onclose) {
                    callbacks.onclose(event);
                }
            };
        });
    }

    async validateApiKey(apiKey) {
        try {
            const testClient = new OpenAI({ apiKey });
            const response = await testClient.models.list();
            
            // Check if GPT models are available
            const hasGPTModels = response.data && response.data.some(m => m.id.includes('gpt'));
            if (hasGPTModels) {
                console.log('[OpenAIProvider] API key validation successful');
                return true;
            } else {
                console.log('[OpenAIProvider] API key valid but no GPT models available');
                return false;
            }
        } catch (error) {
            console.error('[OpenAIProvider] API key validation failed:', error);
            return false;
        }
    }

    getAvailableModels() {
        return {
            chat: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ],
            vision: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
            ]
        };
    }

    formatMessages(messages) {
        // OpenAI uses messages as-is
        return messages;
    }

    formatImageContent(base64Data, mimeType = 'image/jpeg') {
        return {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Data}` }
        };
    }
}

module.exports = { OpenAIProvider }; 