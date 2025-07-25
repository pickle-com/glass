const { Readable } = require('stream');

const API_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

class ZhipuAIProvider {
    /**
     * Validates a ZhipuAI API key.
     * @param {string} key - The ZhipuAI API key.
     * @returns {Promise<{success: boolean, error?: string}>} Validation result.
     */
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid ZhipuAI API key format.' };
        }

        try {
            // We test the key by trying to make a simple, low-cost API call.
            const response = await fetch(`${API_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "glm-4v-flash", // A common, fast model
                    messages: [{ role: "user", content: "Hello" }],
                    max_tokens: 1
                })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[ZhipuAIProvider] Network error during key validation:`, error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
}

/**
 * Creates a ZhipuAI STT session
 * NOTE: ZhipuAI real-time STT API details are not provided. This is a placeholder.
 * @returns {Promise<object>} STT session
 */
async function createSTT({ apiKey, language = 'en', callbacks = {}, ...config }) {
    console.warn('[ZhipuAI STT] Real-time STT is not implemented for ZhipuAI in this version.');
    // When the API is available, implementation would go here.
    return Promise.reject(new Error('ZhipuAI real-time STT not available.'));
}


/**
 * Creates a ZhipuAI LLM instance for synchronous calls.
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - ZhipuAI API key
 * @param {string} [opts.model='glm-4v-flash'] - Model name
 * @param {number} [opts.temperature=0.75] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @param {number} [opts.topP=0.9] - Top P
 * @returns {object} LLM instance
 */
function createLLM({ apiKey, model = 'glm-4v-flash', temperature = 0.75, maxTokens = 2048, topP = 0.9, ...config }) {
    const callApi = async (messages) => {
        const response = await fetch(`${API_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages,
                temperature: temperature,
                top_p: topP,
                // max_tokens: maxTokens,
                stream: false, // Synchronous call
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ZhipuAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        return {
            content: result.choices[0].message.content.trim(),
            raw: result
        };
    };

    return {
        generateContent: async (parts) => {
            const messages = [];
            let systemPrompt = '';
            let userContent = [];

            for (const part of parts) {
                if (typeof part === 'string') {
                    if (systemPrompt === '' && (part.toLowerCase().startsWith('you are') || part.toLowerCase().includes('system prompt'))) {
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

            const result = await callApi(messages);

            return {
                response: {
                    text: () => result.content
                },
                raw: result.raw
            };
        },
        chat: async (messages) => {
            return await callApi(messages);
        }
    };
}

/** 
 * Creates a ZhipuAI streaming LLM instance.
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - ZhipuAI API key
 * @param {string} [opts.model='glm-4v-flash'] - Model name
 * @param {number} [opts.temperature=0.75] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @param {number} [opts.topP=0.9] - Top P
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM({ apiKey, model = 'glm-4v-flash', temperature = 0.75, maxTokens = 2048, topP = 0.9, ...config }) {
    return {
        streamChat: async (messages) => {
            const response = await fetch(`${API_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    messages,
                    temperature: temperature,
                    top_p: topP,
                    // max_tokens: maxTokens,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ZhipuAI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return response;
        }
    };
}

module.exports = {
    ZhipuAIProvider,
    createSTT,
    createLLM,
    createStreamingLLM
};