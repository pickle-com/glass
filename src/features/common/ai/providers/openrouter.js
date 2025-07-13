const OpenAI = require('openai');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

class OpenRouterProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string' || !key.startsWith('sk-')) {
          return { success: false, error: 'Invalid OpenAI API key format.' };
        }

        try {
            const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[OpenRouterProvider] Network error during key validation:`, error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
}

/**
 * Creates an OpenRouter STT session
 * Note: OpenRouter doesn't have native real-time STT, so this is a placeholder
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.language='en'] - Language code
 * @param {object} [opts.callbacks] - Event callbacks
 * @returns {Promise<object>} STT session placeholder
 */
async function createSTT({ apiKey, language = "en", callbacks = {}, ...config }) {
  console.warn("[OpenRouter] STT not natively supported. Consider using OpenAI or Gemini for STT.")

  // Return a mock STT session that doesn't actually do anything
  return {
    sendRealtimeInput: async (audioData) => {
      console.warn("[OpenRouter] STT sendRealtimeInput called but not implemented")
    },
    close: async () => {
      console.log("[OpenRouter] STT session closed")
    },
  }
}

/**
 * Creates an OpenRouter LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.model='x-ai/grok-4'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} LLM instance
 */
function createLLM({ apiKey, model = 'x-ai/grok-4', temperature = 0.7, maxTokens = 2048, ...config }) {
  const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  
  const callApi = async (messages) => {
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });
    return {
      content: response.choices[0].message.content.trim(),
      raw: response
    };
  };

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
      
      const result = await callApi(messages);

      return {
        response: {
          text: () => result.content
        },
        raw: result.raw
      };
    },
    
    // For compatibility with chat-style interfaces
    chat: async (messages) => {
      return await callApi(messages);
    }
  };
}

/** 
 * Creates an OpenRouter streaming LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {string} [opts.model='x-ai'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=2048] - Max tokens
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM({ apiKey, model = 'x-ai/grok-4', temperature = 0.7, maxTokens = 2048, ...config }) {
  return {
    streamChat: async (messages) => {
      console.log("[OpenRouter Provider] Starting Streaming request")
      const fetchUrl = `${OPENROUTER_BASE_URL}/chat/completions`;
      
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      return response;
    }
  };
}

module.exports = {
    OpenRouterProvider,
    createSTT,
    createLLM,
    createStreamingLLM
};