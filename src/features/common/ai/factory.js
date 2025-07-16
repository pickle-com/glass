// factory.js

/**
 * @typedef {object} ModelOption
 * @property {string} id 
 * @property {string} name
 */

/**
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => any} handler
 * @property {ModelOption[]} llmModels
 * @property {ModelOption[]} sttModels
 */

/**
 * @type {Object.<string, Provider>}
 */
const PROVIDERS = {
  'openai': {
      name: 'OpenAI',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe' }
      ],
  },

  'openai-glass': {
      name: 'OpenAI (Glass)',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4.1-glass', name: 'GPT-4.1 (glass)' },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe-glass', name: 'GPT-4o Mini Transcribe (glass)' }
      ],
  },
  'gemini': {
      name: 'Gemini',
      handler: () => require("./providers/gemini"),
      llmModels: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      ],
      sttModels: [
          { id: 'gemini-live-2.5-flash-preview', name: 'Gemini Live 2.5 Flash' }
      ],
  },
  'anthropic': {
      name: 'Anthropic',
      handler: () => require("./providers/anthropic"),
      llmModels: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      ],
      sttModels: [],
  },
  'deepgram': {
    name: 'Deepgram',
    handler: () => require("./providers/deepgram"),
    llmModels: [],
    sttModels: [
        { id: 'nova-3', name: 'Nova-3 (General)' },
        ],
    },
  'ollama': {
      name: 'Ollama (Local)',
      handler: () => require("./providers/ollama"),
      llmModels: [], // Dynamic models populated from installed Ollama models
      sttModels: [], // Ollama doesn't support STT yet
  },
  'whisper': {
      name: 'Whisper (Local)',
      handler: () => {
          // This needs to remain a function due to its conditional logic for renderer/main process
          if (typeof window === 'undefined') {
              const { WhisperProvider } = require("./providers/whisper");
              return new WhisperProvider();
          }
          // Return a dummy object for the renderer process
          return {
              validateApiKey: async () => ({ success: true }), // Mock validate for renderer
              createSTT: () => { throw new Error('Whisper STT is only available in main process'); },
          };
      },
      llmModels: [],
      sttModels: [
          { id: 'whisper-tiny', name: 'Whisper Tiny (39M)' },
          { id: 'whisper-base', name: 'Whisper Base (74M)' },
          { id: 'whisper-small', name: 'Whisper Small (244M)' },
          { id: 'whisper-medium', name: 'Whisper Medium (769M)' },
      ],
  },
};

function sanitizeModelId(model) {
  return (typeof model === 'string') ? model.replace(/-glass$/, '') : model;
}

function createSTT(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createSTT) {
      throw new Error(`STT not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createSTT(opts);
}

function createLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';

  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createLLM) {
      throw new Error(`LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createLLM(opts);
}

function createStreamingLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createStreamingLLM) {
      throw new Error(`Streaming LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createStreamingLLM(opts);
}

function getProviderClass(providerId) {
    const providerConfig = PROVIDERS[providerId];
    if (!providerConfig) return null;
    
    // Handle special cases for glass providers
    let actualProviderId = providerId;
    if (providerId === 'openai-glass') {
        actualProviderId = 'openai';
    }
    
    // The handler function returns the module, from which we get the class.
    const module = providerConfig.handler();
    
    // Map provider IDs to their actual exported class names
    const classNameMap = {
        'openai': 'OpenAIProvider',
        'anthropic': 'AnthropicProvider',
        'gemini': 'GeminiProvider',
        'deepgram': 'DeepgramProvider',
        'ollama': 'OllamaProvider',
        'whisper': 'WhisperProvider'
    };
    
    const className = classNameMap[actualProviderId];
    return className ? module[className] : null;
}

function getAvailableProviders() {
  const stt = [];
  const llm = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
      if (provider.sttModels.length > 0) stt.push(id);
      if (provider.llmModels.length > 0) llm.push(id);
  }
  return { stt: [...new Set(stt)], llm: [...new Set(llm)] };
}

module.exports = {
  PROVIDERS,
  createSTT,
  createLLM,
  createStreamingLLM,
  getProviderClass,
  getAvailableProviders,
};