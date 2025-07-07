const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');

/**
 * Creates a Gemini STT session
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.language='en-US'] - Language code
 * @param {object} [opts.callbacks] - Event callbacks
 * @returns {Promise<object>} STT session
 */
async function createSTT({ apiKey, language = 'en-US', callbacks = {}, ...config }) {
  const liveClient = new GoogleGenAI({ vertexai: false, apiKey });

  // Language code BCP-47 conversion
  const lang = language.includes('-') ? language : `${language}-US`;

  const session = await liveClient.live.connect({
    model: 'gemini-live-2.5-flash-preview',
    callbacks,
    config: {
      inputAudioTranscription: {},
      speechConfig: { languageCode: lang },
    },
  });

  return {
    sendRealtimeInput: async payload => session.sendRealtimeInput(payload),
    close: async () => session.close(),
  };
}

/**
 * Creates a Gemini LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.model='gemini-2.5-flash'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=8192] - Max tokens
 * @returns {object} LLM instance
 */
function createLLM({ apiKey, model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 8192, ...config }) {
  const client = new GoogleGenerativeAI(apiKey);
  
  return {
    generateContent: async (parts) => {
      const geminiModel = client.getGenerativeModel({ model: model });
      
      let systemPrompt = '';
      let userContent = [];
      
      for (const part of parts) {
        if (typeof part === 'string') {
          if (systemPrompt === '' && part.includes('You are')) {
            systemPrompt = part;
          } else {
            userContent.push(part);
          }
        } else if (part.inlineData) {
          // Convert base64 image data to Gemini format
          userContent.push({
            inlineData: {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data
            }
          });
        }
      }
      
      // Prepare content array
      const content = [];
      
      // Add system instruction if present
      if (systemPrompt) {
        // For Gemini, we'll prepend system prompt to user content
        content.push(systemPrompt + '\n\n' + userContent[0]);
        content.push(...userContent.slice(1));
      } else {
        content.push(...userContent);
      }
      
      try {
        const result = await geminiModel.generateContent(content);
        const response = await result.response;
        
        return {
          response: {
            text: () => response.text()
          }
        };
      } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
      }
    },
    
    // For compatibility with chat-style interfaces
    chat: async (messages) => {
      // Extract system instruction if present
      let systemInstruction = '';
      const history = [];
      let lastMessage;

      messages.forEach((msg, index) => {
        if (msg.role === 'system') {
          systemInstruction = msg.content;
          return;
        }
        
        // Gemini's history format
        const role = msg.role === 'user' ? 'user' : 'model';

        if (index === messages.length - 1) {
            lastMessage = msg;
        } else {
            history.push({ role, parts: [{ text: msg.content }] });
        }
      });
      
      const geminiModel = client.getGenerativeModel({ 
        model: model,
        systemInstruction: systemInstruction
      });
      
      const chat = geminiModel.startChat({
        history: history,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
        }
      });
      
      // Get the last user message content
      let content = lastMessage.content;
      
      // Handle multimodal content for the last message
      if (Array.isArray(content)) {
        const geminiContent = [];
        for (const part of content) {
          if (typeof part === 'string') {
            geminiContent.push(part);
          } else if (part.type === 'text') {
            geminiContent.push(part.text);
          } else if (part.type === 'image_url' && part.image_url) {
            // Convert base64 image to Gemini format
            const base64Data = part.image_url.url.split(',')[1];
            geminiContent.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
        }
        content = geminiContent;
      }
      
      const result = await chat.sendMessage(content);
      const response = await result.response;
      return {
        content: response.text(),
        raw: result
      };
    }
  };
}

/**
 * Creates a Gemini streaming LLM instance
 * @param {object} opts - Configuration options
 * @param {string} opts.apiKey - Gemini API key
 * @param {string} [opts.model='gemini-2.5-flash'] - Model name
 * @param {number} [opts.temperature=0.7] - Temperature
 * @param {number} [opts.maxTokens=8192] - Max tokens
 * @returns {object} Streaming LLM instance
 */
function createStreamingLLM({ apiKey, model = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 8192, ...config }) {
  const client = new GoogleGenerativeAI(apiKey);
  
  return {
    streamChat: async (messages) => {
      console.log('[Gemini Provider] Starting streaming request');
      
      // Extract system instruction if present
      let systemInstruction = '';
      const nonSystemMessages = [];
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemInstruction = msg.content;
        } else {
          nonSystemMessages.push(msg);
        }
      }
      
      const geminiModel = client.getGenerativeModel({ 
        model: model,
        systemInstruction: systemInstruction || undefined
      });
      
      const chat = geminiModel.startChat({
        history: [],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens || 8192,
        }
      });
      
      // Create a ReadableStream to handle Gemini's streaming
      const stream = new ReadableStream({
        async start(controller) {
          try {
            console.log('[Gemini Provider] Processing messages:', nonSystemMessages.length, 'messages (excluding system)');
            
            // Get the last user message
            const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
            let lastUserMessage = lastMessage.content;
            
            // Handle case where content might be an array (multimodal)
            if (Array.isArray(lastUserMessage)) {
              // Extract text content from array
              const textParts = lastUserMessage.filter(part => 
                typeof part === 'string' || (part && part.type === 'text')
              );
              lastUserMessage = textParts.map(part => 
                typeof part === 'string' ? part : part.text
              ).join(' ');
            }
            
            console.log('[Gemini Provider] Sending message to Gemini:', 
              typeof lastUserMessage === 'string' ? lastUserMessage.substring(0, 100) + '...' : 'multimodal content');
            
            // Prepare the message content for Gemini
            let geminiContent = [];
            
            // Handle multimodal content properly
            if (Array.isArray(lastMessage.content)) {
              for (const part of lastMessage.content) {
                if (typeof part === 'string') {
                  geminiContent.push(part);
                } else if (part.type === 'text') {
                  geminiContent.push(part.text);
                } else if (part.type === 'image_url' && part.image_url) {
                  // Convert base64 image to Gemini format
                  const base64Data = part.image_url.url.split(',')[1];
                  geminiContent.push({
                    inlineData: {
                      mimeType: 'image/png',
                      data: base64Data
                    }
                  });
                }
              }
            } else {
              geminiContent = [lastUserMessage];
            }
            
            console.log('[Gemini Provider] Prepared Gemini content:', 
              geminiContent.length, 'parts');
            
            // Stream the response
            let chunkCount = 0;
            let totalContent = '';
            
            const contentParts = geminiContent.map(part => {
              if (typeof part === 'string') {
                return { text: part };
              } else if (part.inlineData) {
                return { inlineData: part.inlineData };
              }
              return part;
            });

            const result = await geminiModel.generateContentStream({
              contents: [{
                role: 'user',
                parts: contentParts
              }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens || 8192,
              }
            });
            
            for await (const chunk of result.stream) {
              chunkCount++;
              const chunkText = chunk.text() || '';
              totalContent += chunkText;
              
              // Format as SSE data
              const data = JSON.stringify({
                choices: [{
                  delta: {
                    content: chunkText
                  }
                }]
              });
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
            }
            
            console.log(`[Gemini Provider] Streamed ${chunkCount} chunks, total length: ${totalContent.length} chars`);
            
            // Send the final done message
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            console.log('[Gemini Provider] Streaming completed successfully');
          } catch (error) {
            console.error('[Gemini Provider] Streaming error:', error);
            controller.error(error);
          }
        }
      });
      
      // Create a Response object with the stream
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
  };
}

module.exports = {
  createSTT,
  createLLM,
  createStreamingLLM
}; 
