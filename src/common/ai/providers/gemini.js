const { GoogleGenerativeAI } = require("@google/generative-ai")
const { GoogleGenAI } = require("@google/genai")

class GeminiProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid Gemini API key format.' };
        }

        try {
            const validationUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            const response = await fetch(validationUrl);

            if (response.ok) {
                return { success: true };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || `Validation failed with status: ${response.status}`;
                return { success: false, error: message };
            }
        } catch (error) {
            console.error(`[GeminiProvider] Network error during key validation:`, error);
            return { success: false, error: 'A network error occurred during validation.' };
        }
    }
}


/**
 * Creates a Gemini STT session
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.language='en-US'] - Language code
 * @param {object} [opts.callbacks] - Event callbacks
 * @returns {Promise<object>} STT session
 */
async function createSTT({ apiKey, language = "en-US", callbacks = {}, ...config }) {
  const liveClient = new GoogleGenAI({ vertexai: false, apiKey })

  // Language code BCP-47 conversion
  const lang = language.includes("-") ? language : `${language}-US`

  const session = await liveClient.live.connect({

    model: 'gemini-live-2.5-flash-preview',
    callbacks: {
      ...callbacks,
      onMessage: (msg) => {
        if (!msg || typeof msg !== 'object') return;
        msg.provider = 'gemini';
        callbacks.onmessage?.(msg);
      }
    },

    config: {
      inputAudioTranscription: {},
      speechConfig: { languageCode: lang },
    },
  })

  return {
    sendRealtimeInput: async (payload) => session.sendRealtimeInput(payload),
    close: async () => session.close(),
  }
}

/**
 * Creates a Gemini LLM instance with proper text response handling
 */
function createLLM({ apiKey, model = "gemini-2.5-flash", temperature = 0.7, maxTokens = 8192, ...config }) {
  const client = new GoogleGenerativeAI(apiKey)

  return {
    generateContent: async (parts) => {
      const geminiModel = client.getGenerativeModel({
        model: model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          // Ensure we get text responses, not JSON
          responseMimeType: "text/plain",
        },
      })

      const systemPrompt = ""
      const userContent = []

      for (const part of parts) {
        if (typeof part === "string") {
          // Don't automatically assume strings starting with "You are" are system prompts
          // Check if it's explicitly marked as a system instruction
          userContent.push(part)
        } else if (part.inlineData) {
          userContent.push({
            inlineData: {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          })
        }
      }

      try {
        const result = await geminiModel.generateContent(userContent)
        const response = await result.response

        // Return plain text, not wrapped in JSON structure
        return {
          response: {
            text: () => response.text(),
          },
        }
      } catch (error) {
        console.error("Gemini API error:", error)
        throw error
      }
    },

    chat: async (messages) => {
      // Filter out any system prompts that might be causing JSON responses
      let systemInstruction = ""
      const history = []
      let lastMessage

      messages.forEach((msg, index) => {
        if (msg.role === "system") {
          // Clean system instruction - avoid JSON formatting requests
          systemInstruction = msg.content
            .replace(/respond in json/gi, "")
            .replace(/format.*json/gi, "")
            .replace(/return.*json/gi, "")

          // Add explicit instruction for natural text
          if (!systemInstruction.includes("respond naturally")) {
            systemInstruction += "\n\nRespond naturally in plain text, not in JSON or structured format."
          }
          return
        }

        const role = msg.role === "user" ? "user" : "model"

        if (index === messages.length - 1) {
          lastMessage = msg
        } else {
          history.push({ role, parts: [{ text: msg.content }] })
        }
      })

      const geminiModel = client.getGenerativeModel({
        model: model,
        systemInstruction:
          systemInstruction ||
          "Respond naturally in plain text format. Do not use JSON or structured responses unless specifically requested.",
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          // Force plain text responses
          responseMimeType: "text/plain",
        },
      })

      const chat = geminiModel.startChat({
        history: history,
      })

      let content = lastMessage.content

      // Handle multimodal content
      if (Array.isArray(content)) {
        const geminiContent = []
        for (const part of content) {
          if (typeof part === "string") {
            geminiContent.push(part)
          } else if (part.type === "text") {
            geminiContent.push(part.text)
          } else if (part.type === "image_url" && part.image_url) {
            const base64Data = part.image_url.url.split(",")[1]
            geminiContent.push({
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            })
          }
        }
        content = geminiContent
      }

      const result = await chat.sendMessage(content)
      const response = await result.response

      // Return plain text content
      return {
        content: response.text(),
        raw: result,
      }
    },
  }
}

/**
 * Creates a Gemini streaming LLM instance with text response fix
 */
function createStreamingLLM({ apiKey, model = "gemini-2.5-flash", temperature = 0.7, maxTokens = 8192, ...config }) {
  const client = new GoogleGenerativeAI(apiKey)

  return {
    streamChat: async (messages) => {
      console.log("[Gemini Provider] Starting streaming request")

      let systemInstruction = ""
      const nonSystemMessages = []

      for (const msg of messages) {
        if (msg.role === "system") {
          // Clean and modify system instruction
          systemInstruction = msg.content
            .replace(/respond in json/gi, "")
            .replace(/format.*json/gi, "")
            .replace(/return.*json/gi, "")

          if (!systemInstruction.includes("respond naturally")) {
            systemInstruction += "\n\nRespond naturally in plain text, not in JSON or structured format."
          }
        } else {
          nonSystemMessages.push(msg)
        }
      }

      const geminiModel = client.getGenerativeModel({
        model: model,
        systemInstruction:
          systemInstruction ||
          "Respond naturally in plain text format. Do not use JSON or structured responses unless specifically requested.",
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens || 8192,
          // Force plain text responses
          responseMimeType: "text/plain",
        },
      })

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const lastMessage = nonSystemMessages[nonSystemMessages.length - 1]
            let geminiContent = []

            if (Array.isArray(lastMessage.content)) {
              for (const part of lastMessage.content) {
                if (typeof part === "string") {
                  geminiContent.push(part)
                } else if (part.type === "text") {
                  geminiContent.push(part.text)
                } else if (part.type === "image_url" && part.image_url) {
                  const base64Data = part.image_url.url.split(",")[1]
                  geminiContent.push({
                    inlineData: {
                      mimeType: "image/png",
                      data: base64Data,
                    },
                  })
                }
              }
            } else {
              geminiContent = [lastMessage.content]
            }

            const contentParts = geminiContent.map((part) => {
              if (typeof part === "string") {
                return { text: part }
              } else if (part.inlineData) {
                return { inlineData: part.inlineData }
              }
              return part
            })

            const result = await geminiModel.generateContentStream({
              contents: [
                {
                  role: "user",
                  parts: contentParts,
                },
              ],
            })

            for await (const chunk of result.stream) {
              const chunkText = chunk.text() || ""

              // Format as SSE data - this should now be plain text
              const data = JSON.stringify({
                choices: [
                  {
                    delta: {
                      content: chunkText,
                    },
                  },
                ],
              })
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
            }

            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
            controller.close()
          } catch (error) {
            console.error("[Gemini Provider] Streaming error:", error)
            controller.error(error)
          }
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    },
  }
}

module.exports = {
    GeminiProvider,
    createSTT,
    createLLM,
    createStreamingLLM
};
