const providers = {
  openai: require('./providers/openai'),
  gemini: require('./providers/gemini'),
  // 추가 provider는 여기에 등록
};

/**
 * Creates an STT session based on provider
 * @param {string} provider - Provider name ('openai', 'gemini', etc.)
 * @param {object} opts - Configuration options (apiKey, language, callbacks, etc.)
 * @returns {Promise<object>} STT session object with sendRealtimeInput and close methods
 */
function createSTT(provider, opts) {
  if (!providers[provider]?.createSTT) {
    throw new Error(`STT not supported for provider: ${provider}`);
  }
  return providers[provider].createSTT(opts);
}

/**
 * Creates an LLM instance based on provider
 * @param {string} provider - Provider name ('openai', 'gemini', etc.)
 * @param {object} opts - Configuration options (apiKey, model, temperature, etc.)
 * @returns {object} LLM instance with generateContent method
 */
function createLLM(provider, opts) {
  if (!providers[provider]?.createLLM) {
    throw new Error(`LLM not supported for provider: ${provider}`);
  }
  return providers[provider].createLLM(opts);
}

/**
 * Creates a streaming LLM instance based on provider
 * @param {string} provider - Provider name ('openai', 'gemini', etc.)
 * @param {object} opts - Configuration options (apiKey, model, temperature, etc.)
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM(provider, opts) {
  if (!providers[provider]?.createStreamingLLM) {
    throw new Error(`Streaming LLM not supported for provider: ${provider}`);
  }
  return providers[provider].createStreamingLLM(opts);
}

/**
 * Gets list of available providers
 * @returns {object} Object with stt and llm arrays
 */
function getAvailableProviders() {
  const sttProviders = [];
  const llmProviders = [];
  
  for (const [name, provider] of Object.entries(providers)) {
    if (provider.createSTT) sttProviders.push(name);
    if (provider.createLLM) llmProviders.push(name);
  }
  
  return { stt: sttProviders, llm: llmProviders };
}

module.exports = {
  createSTT,
  createLLM,
  createStreamingLLM,
  getAvailableProviders
}; 