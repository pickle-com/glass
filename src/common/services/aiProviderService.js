const { createOpenAiGenerativeClient, getOpenAiGenerativeModel } = require('./openAiClient.js');
const { createGeminiClient, getGeminiGenerativeModel } = require('./googleGeminiClient.js');

/**
 * Creates an AI client based on the provider
 * @param {string} apiKey - The API key
 * @param {string} provider - The provider ('openai' or 'gemini')
 * @returns {object} The AI client
 */
function createAIClient(apiKey, provider = 'openai') {
    switch (provider) {
        case 'openai':
            return createOpenAiGenerativeClient(apiKey);
        case 'gemini':
            return createGeminiClient(apiKey);
        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Gets a generative model based on the provider
 * @param {object} client - The AI client
 * @param {string} provider - The provider ('openai' or 'gemini')
 * @param {string} model - The model name (optional)
 * @returns {object} The model object
 */
function getGenerativeModel(client, provider = 'openai', model) {
    switch (provider) {
        case 'openai':
            return getOpenAiGenerativeModel(client, model || 'gpt-4.1');
        case 'gemini':
            return getGeminiGenerativeModel(client, model || 'gemini-2.5-flash');
        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Makes a chat completion request based on the provider
 * @param {object} params - Request parameters
 * @returns {Promise<object>} The completion response
 */
async function makeChatCompletion({ apiKey, provider = 'openai', messages, temperature = 0.7, maxTokens = 1024, model, stream = false }) {
    if (provider === 'openai') {
        const fetchUrl = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'gpt-4.1',
                messages,
                temperature,
                max_tokens: maxTokens,
                stream,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        if (stream) {
            return response;
        }

        const result = await response.json();
        return {
            content: result.choices[0].message.content.trim(),
            raw: result
        };
    } else if (provider === 'gemini') {
        const client = createGeminiClient(apiKey);
        const genModel = getGeminiGenerativeModel(client, model || 'gemini-2.5-flash');
        
        // Convert OpenAI format messages to Gemini format
        const parts = [];
        for (const message of messages) {
            if (message.role === 'system') {
                parts.push(message.content);
            } else if (message.role === 'user') {
                if (typeof message.content === 'string') {
                    parts.push(message.content);
                } else if (Array.isArray(message.content)) {
                    // Handle multimodal content
                    for (const part of message.content) {
                        if (part.type === 'text') {
                            parts.push(part.text);
                        } else if (part.type === 'image_url' && part.image_url?.url) {
                            // Extract base64 data from data URL
                            const base64Match = part.image_url.url.match(/^data:(.+);base64,(.+)$/);
                            if (base64Match) {
                                parts.push({
                                    inlineData: {
                                        mimeType: base64Match[1],
                                        data: base64Match[2]
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
        
        const result = await genModel.generateContent(parts);
        return {
            content: result.response.text(),
            raw: result
        };
    } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Makes a chat completion request with Portkey support
 * @param {object} params - Request parameters including Portkey options
 * @returns {Promise<object>} The completion response
 */
async function makeChatCompletionWithPortkey({ 
    apiKey, 
    provider = 'openai', 
    messages, 
    temperature = 0.7, 
    maxTokens = 1024, 
    model, 
    usePortkey = false,
    portkeyVirtualKey = null 
}) {
    if (!usePortkey) {
        return makeChatCompletion({ apiKey, provider, messages, temperature, maxTokens, model });
    }
    
    // Portkey is only supported for OpenAI currently
    if (provider !== 'openai') {
        console.warn('Portkey is only supported for OpenAI provider, falling back to direct API');
        return makeChatCompletion({ apiKey, provider, messages, temperature, maxTokens, model });
    }
    
    const fetchUrl = 'https://api.portkey.ai/v1/chat/completions';
    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
            'x-portkey-api-key': 'gRv2UGRMq6GGLJ8aVEB4e7adIewu',
            'x-portkey-virtual-key': portkeyVirtualKey || apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model || 'gpt-4.1',
            messages,
            temperature,
            max_tokens: maxTokens,
        }),
    });

    if (!response.ok) {
        throw new Error(`Portkey API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return {
        content: result.choices[0].message.content.trim(),
        raw: result
    };
}

/**
 * Makes a streaming chat completion request
 * @param {object} params - Request parameters
 * @returns {Promise<Response>} The streaming response
 */
async function makeStreamingChatCompletion({ apiKey, provider = 'openai', messages, temperature = 0.7, maxTokens = 1024, model }) {
    if (provider === 'openai') {
        const fetchUrl = 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'gpt-4.1',
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return response;
    } else if (provider === 'gemini') {
        // Gemini doesn't support SSE streaming in the same way
        // We'll need to handle this differently
        throw new Error('Streaming is not yet implemented for Gemini provider');
    } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Makes a streaming chat completion request with Portkey support
 * @param {object} params - Request parameters
 * @returns {Promise<Response>} The streaming response
 */
async function makeStreamingChatCompletionWithPortkey({ 
    apiKey, 
    provider = 'openai', 
    messages, 
    temperature = 0.7, 
    maxTokens = 1024, 
    model, 
    usePortkey = false,
    portkeyVirtualKey = null 
}) {
    if (!usePortkey) {
        return makeStreamingChatCompletion({ apiKey, provider, messages, temperature, maxTokens, model });
    }
    
    // Portkey is only supported for OpenAI currently
    if (provider !== 'openai') {
        console.warn('Portkey is only supported for OpenAI provider, falling back to direct API');
        return makeStreamingChatCompletion({ apiKey, provider, messages, temperature, maxTokens, model });
    }
    
    const fetchUrl = 'https://api.portkey.ai/v1/chat/completions';
    const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
            'x-portkey-api-key': 'gRv2UGRMq6GGLJ8aVEB4e7adIewu',
            'x-portkey-virtual-key': portkeyVirtualKey || apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model || 'gpt-4.1',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        }),
    });

    if (!response.ok) {
        throw new Error(`Portkey API error: ${response.status} ${response.statusText}`);
    }

    return response;
}

module.exports = {
    createAIClient,
    getGenerativeModel,
    makeChatCompletion,
    makeChatCompletionWithPortkey,
    makeStreamingChatCompletion,
    makeStreamingChatCompletionWithPortkey
};