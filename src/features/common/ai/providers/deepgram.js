// providers/deepgram.js

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const WebSocket = require('ws');

/**
 * Deepgram Provider 클래스. API 키 유효성 검사를 담당합니다.
 */
class DeepgramProvider {
    /**
     * Deepgram API 키의 유효성을 검사합니다.
     * @param {string} key - 검사할 Deepgram API 키
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid Deepgram API key format.' };
        }
        try {
            // ✨ 변경점: SDK 대신 직접 fetch로 API를 호출하여 안정성 확보 (openai.js 방식)
            const response = await fetch('https://api.deepgram.com/v1/projects', {
                headers: { 'Authorization': `Token ${key}` }
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.err_msg || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[DeepgramProvider] Network error during key validation:`, error);
            return { success: false, error: error.message || 'A network error occurred during validation.' };
        }
    }
}

function createSTT({
    apiKey,
    language = 'en-US',
    sampleRate = 24000,
    callbacks = {},
  }) {
    const qs = new URLSearchParams({
      model: 'nova-3',
      encoding: 'linear16',
      sample_rate: sampleRate.toString(),
      language,
      smart_format: 'true',
      interim_results: 'true',
      channels: '1',
    });
  
    const url = `wss://api.deepgram.com/v1/listen?${qs}`;
  
    const ws = new WebSocket(url, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    ws.binaryType = 'arraybuffer';
  
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        ws.terminate();
        reject(new Error('DG open timeout (10 s)'));
      }, 10_000);
  
      ws.on('open', () => {
        clearTimeout(to);
        resolve({
          sendRealtimeInput: (buf) => ws.send(buf),
          close: () => ws.close(1000, 'client'),
        });
      });
  
      ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (msg.channel?.alternatives?.[0]?.transcript !== undefined) {
          callbacks.onmessage?.({ provider: 'deepgram', ...msg });
        }
      });
  
      ws.on('close', (code, reason) =>
        callbacks.onclose?.({ code, reason: reason.toString() })
      );
  
      ws.on('error', err => {
        clearTimeout(to);
        callbacks.onerror?.(err);
        reject(err);
      });
    });
  }

// ... (LLM 관련 Placeholder 함수들은 그대로 유지) ...
function createLLM(opts) {
  console.warn("[Deepgram] LLM not supported.");
  return { generateContent: async () => { throw new Error("Deepgram does not support LLM functionality."); } };
}
function createStreamingLLM(opts) {
  console.warn("[Deepgram] Streaming LLM not supported.");
  return { streamChat: async () => { throw new Error("Deepgram does not support Streaming LLM functionality."); } };
}

module.exports = {
    DeepgramProvider,
    createSTT,
    createLLM,
    createStreamingLLM
};