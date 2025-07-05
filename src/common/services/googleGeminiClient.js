const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Creates and returns a Google Gemini client instance for generative AI.
 * @param {string} apiKey - The API key for authentication.
 * @returns {GoogleGenerativeAI} The initialized Gemini client.
 */
function createGeminiClient(apiKey) {
    return new GoogleGenerativeAI(apiKey);
}

/**
 * Gets a Gemini model for text/image generation.
 * @param {GoogleGenerativeAI} client - The Gemini client instance.
 * @param {string} [model='gemini-2.5-flash'] - The name for the text/vision model.
 * @returns {object} Model object with generateContent method
 */
function getGeminiGenerativeModel(client, model = 'gemini-2.5-flash') {
    const genAI = client;
    const geminiModel = genAI.getGenerativeModel({ model: model });
    
    return {
        generateContent: async (parts) => {
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
        }
    };
}

/**
 * Creates a Gemini chat session for multi-turn conversations.
 * @param {GoogleGenerativeAI} client - The Gemini client instance.
 * @param {string} [model='gemini-2.5-flash'] - The model to use.
 * @param {object} [config={}] - Configuration options.
 * @returns {object} Chat session object
 */
function createGeminiChat(client, model = 'gemini-2.5-flash', config = {}) {
    const genAI = client;
    const geminiModel = genAI.getGenerativeModel({ 
        model: model,
        systemInstruction: config.systemInstruction
    });
    
    const chat = geminiModel.startChat({
        history: config.history || [],
        generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxOutputTokens || 8192,
        }
    });
    
    return {
        sendMessage: async (message) => {
            const result = await chat.sendMessage(message);
            const response = await result.response;
            return {
                text: response.text()
            };
        },
        sendMessageStream: async function* (message) {
            const result = await chat.sendMessageStream(message);
            for await (const chunk of result.stream) {
                yield {
                    text: chunk.text()
                };
            }
        },
        getHistory: () => chat.getHistory()
    };
}

module.exports = {
    createGeminiClient,
    getGeminiGenerativeModel,
    createGeminiChat
};