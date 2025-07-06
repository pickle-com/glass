const OpenAI = require('openai');
const WebSocket = require('ws');

/**
 * Creates and returns an OpenAI client instance for STT (Speech-to-Text).
 * @param {string} apiKey - The API key for authentication.
 * @returns {OpenAI} The initialized OpenAI client.
 */
function createOpenAiClient(apiKey) {
    return new OpenAI({
        apiKey: apiKey,
    });
}

/**
 * Creates and returns an OpenAI client instance for text/image generation.
 * @param {string} apiKey - The API key for authentication.
 * @returns {OpenAI} The initialized OpenAI client.
 */
function createOpenAiGenerativeClient(apiKey) {
    return new OpenAI({
        apiKey: apiKey,
    });
}

/**
 * Connects to an OpenAI Realtime WebSocket session for STT.
 * @param {string} key     - Portkey vKey  or  OpenAI apiKey.
 * @param {object} config - The configuration object for the realtime session.
 * @param {'apiKey'|'vKey'} keyType -   key type ('apiKey' | 'vKey').
 * @returns {Promise<object>} A promise that resolves to the session object with send and close methods.
 */
async function connectToOpenAiSession(key, config, keyType) {
    if (keyType !== 'apiKey' && keyType !== 'vKey') {
        throw new Error('keyType must be either "apiKey" or "vKey".');
    }

    const wsUrl = keyType === 'apiKey'
        ? 'wss://api.openai.com/v1/realtime?intent=transcription'
        : 'wss://api.portkey.ai/v1/realtime?intent=transcription';

    const headers = keyType === 'apiKey'
        ? {
            'Authorization': `Bearer ${key}`,
            'OpenAI-Beta' : 'realtime=v1',
          }
        : {
            'x-portkey-api-key'   : 'gRv2UGRMq6GGLJ8aVEB4e7adIewu',
            'x-portkey-virtual-key': key,
            'OpenAI-Beta'         : 'realtime=v1',
          };

    const ws = new WebSocket(wsUrl, { headers });

    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            console.log("WebSocket session opened.");

            const sessionConfig = {
                type: 'transcription_session.update',
                session: {
                    input_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'gpt-4o-mini-transcribe',
                        prompt: config.prompt || '',
                        language: config.language || 'en'
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
            if (config.callbacks && config.callbacks.onmessage) {
                config.callbacks.onmessage(message);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error.message);
            if (config.callbacks && config.callbacks.onerror) {
                config.callbacks.onerror(error);
            }
            reject(error);
        };

        ws.onclose = (event) => {
            console.log(`WebSocket closed: ${event.code} ${event.reason}`);
            if (config.callbacks && config.callbacks.onclose) {
                config.callbacks.onclose(event);
            }
        };
    });
}

/**
 * Gets a GPT model for text/image generation.
 * @param {OpenAI} client - The OpenAI client instance.
 * @param {string} [model='gpt-4.1'] - The name for the text/vision model.
 * @returns {object} Model object with generateContent method
 */
function getOpenAiGenerativeModel(client, model = 'gpt-4.1') {
    return {
        generateContent: async (parts) => {
            const messages = [];
            let systemPrompt = '';
            let userContent = [];
            
            for (const part of parts) {
                if (typeof part === 'string') {
                    if (systemPrompt === '' && part.includes('You are')) {
                        systemPrompt = part;
                    } else {
                        userContent.push({ type: 'text', text: part });
                    }
                } else if (part.inlineData) {
                    userContent.push({
                        type: 'image_url',
                        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
                    });
                }
            }
            
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            if (userContent.length > 0) messages.push({ role: 'user', content: userContent });
            
            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048
            });
            
            return {
                response: {
                    text: () => response.choices[0].message.content
                }
            };
        }
    };
}

module.exports = {
    createOpenAiClient,
    connectToOpenAiSession,
    createOpenAiGenerativeClient,
    getOpenAiGenerativeModel,
};