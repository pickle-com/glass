class CerebrasProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid Cerebras API key format.' };
        }

        try {
            const response = await fetch('https://api.cerebras.ai/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                },
            });

            if (response.ok) {
                return { success: true };
            } else {
                // Some OpenAI-compatible endpoints may return JSON error bodies
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error('[CerebrasProvider] Network error during key validation:', error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
}

/**
 * Creates a Cerebras LLM instance (OpenAI-compatible Chat Completions)
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model='llama-3.1-8b-instruct']
 * @param {number} [opts.temperature=0.7]
 * @param {number} [opts.maxTokens=2048]
 * @returns {object}
 */
function createLLM({ apiKey, model = 'llama-3.1-8b-instruct', temperature = 0.7, maxTokens = 2048, ...config }) {
  const callApi = async (messages) => {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText} ${text}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    return {
      content: typeof content === 'string' ? content.trim() : '',
      raw: result,
    };
  };

  return {
    generateContent: async (parts) => {
      const messages = [];
      let systemPrompt = '';
      const userContent = [];

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
            image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
          });
        }
      }

      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      if (userContent.length > 0) messages.push({ role: 'user', content: userContent });

      const result = await callApi(messages);
      return {
        response: {
          text: () => result.content,
        },
        raw: result.raw,
      };
    },

    chat: async (messages) => {
      return await callApi(messages);
    },
  };
}

/**
 * Creates a Cerebras streaming LLM instance (SSE via OpenAI-compatible stream)
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model='llama-3.1-8b-instruct']
 * @param {number} [opts.temperature=0.7]
 * @param {number} [opts.maxTokens=2048]
 * @returns {object}
 */
function createStreamingLLM({ apiKey, model = 'llama-3.1-8b-instruct', temperature = 0.7, maxTokens = 2048, ...config }) {
  return {
    streamChat: async (messages) => {
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
      }

      return response;
    },
  };
}

module.exports = {
  CerebrasProvider,
  createLLM,
  createStreamingLLM,
};

