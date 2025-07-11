const { ipcMain, BrowserWindow } = require('electron');
const { createStreamingLLM } = require('../../common/ai/factory');
const { getStoredApiKey, getStoredProvider, windowPool, captureScreenshot } = require('../../electron/windowManager');
const authService = require('../../common/services/authService');
const sessionRepository = require('../../common/repositories/session');
const askRepository = require('./repositories');
const { getSystemPrompt } = require('../../common/prompts/promptBuilder');

// Conversation state management
let conversationState = {
    phase: 'greeting', // 'greeting', 'planning', 'task_assigned', 'feedback', 'approved'
    currentTask: null,
    projectDescription: null,
    completedTasks: [],
    currentTaskNumber: 0
};

function formatConversationForPrompt(conversationTexts) {
    if (!conversationTexts || conversationTexts.length === 0) return 'No conversation history available.';
    return conversationTexts.slice(-30).join('\n');
}

// Access conversation history via the global listenService instance created in index.js
function getConversationHistory() {
    const listenService = global.listenService;
    return listenService ? listenService.getConversationHistory() : [];
}

function resetConversationState() {
    conversationState = {
        phase: 'greeting',
        currentTask: null,
        projectDescription: null,
        completedTasks: [],
        currentTaskNumber: 0
    };
    
    // Send initial task update
    sendTaskUpdate();
}

function updateConversationState(newState) {
    const previousPhase = conversationState.phase;
    conversationState = { ...conversationState, ...newState };
    console.log(`[AskService] State updated from ${previousPhase} to ${conversationState.phase}:`, conversationState);
    
    // Send task updates to the task window
    sendTaskUpdate();
    
    // Show task window when we transition to task_assigned phase
    if (conversationState.phase === 'task_assigned' && previousPhase !== 'task_assigned') {
        console.log('[AskService] Transitioning to task_assigned phase, showing task window');
        showTaskWindow();
    }
}

function sendTaskUpdate() {
    console.log('[AskService] sendTaskUpdate called with state:', conversationState);
    const taskWindow = windowPool.get('task');
    console.log('[AskService] taskWindow exists in sendTaskUpdate:', !!taskWindow);
    
    if (taskWindow && !taskWindow.isDestroyed()) {
        console.log('[AskService] Sending task-updated to task window');
        taskWindow.webContents.send('task-updated', conversationState);
    } else {
        console.log('[AskService] Cannot send task update - window not available');
    }
}

function showTaskWindow() {
    console.log('[AskService] showTaskWindow called');
    const taskWindow = windowPool.get('task');
    console.log('[AskService] taskWindow exists:', !!taskWindow);
    console.log('[AskService] Available windows:', Array.from(windowPool.keys()));
    
    if (taskWindow && !taskWindow.isDestroyed()) {
        console.log('[AskService] taskWindow is not destroyed');
        console.log('[AskService] taskWindow.isVisible():', taskWindow.isVisible());
        
        if (!taskWindow.isVisible()) {
            console.log('[AskService] Showing task window');
            
            // Position the window in top-right before showing
            positionTaskWindowTopRight(taskWindow);
            
            taskWindow.show();
            taskWindow.webContents.send('window-show-animation');
            
            // Update layout after showing task window
            setTimeout(() => {
                console.log('[AskService] Updating layout after showing task window');
                // Send IPC message to trigger layout update
                BrowserWindow.getAllWindows().forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('update-layout');
                    }
                });
            }, 100);
        } else {
            console.log('[AskService] Task window is already visible');
            // Even if visible, make sure it's in the right position
            positionTaskWindowTopRight(taskWindow);
        }
    } else {
        console.log('[AskService] Task window not found or destroyed');
        console.log('[AskService] Attempting to create task window...');
        
        // Try to trigger task window creation
        setTimeout(() => {
            const retryTaskWindow = windowPool.get('task');
            if (retryTaskWindow) {
                console.log('[AskService] Task window found after retry');
                positionTaskWindowTopRight(retryTaskWindow);
                retryTaskWindow.show();
                retryTaskWindow.webContents.send('window-show-animation');
            } else {
                console.log('[AskService] Task window still not available after retry');
            }
        }, 500);
    }
}

function positionTaskWindowTopRight(taskWindow) {
    if (!taskWindow || taskWindow.isDestroyed()) return;
    
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: workAreaX, y: workAreaY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
    
    const taskBounds = taskWindow.getBounds();
    const PAD = 16;
    
    // Position in top right corner
    const taskX = workAreaX + screenWidth - taskBounds.width - PAD;
    const taskY = workAreaY + PAD;
    
    console.log('[AskService] Positioning task window at top-right:', { taskX, taskY, screenWidth, screenHeight });
    
    taskWindow.setBounds({
        x: taskX,
        y: taskY,
        width: taskBounds.width,
        height: taskBounds.height
    });
}

function buildContextualPrompt(userPrompt, conversationHistory) {
    let contextualPrompt = `Current conversation phase: ${conversationState.phase}\n`;
    
    if (conversationState.projectDescription) {
        contextualPrompt += `Project description: ${conversationState.projectDescription}\n`;
    }
    
    if (conversationState.completedTasks.length > 0) {
        contextualPrompt += `Completed tasks: ${conversationState.completedTasks.join(', ')}\n`;
    }
    
    if (conversationState.currentTask) {
        contextualPrompt += `Current task: ${conversationState.currentTask}\n`;
    }
    
    contextualPrompt += `User message: ${userPrompt}\n`;
    contextualPrompt += `Conversation history: ${conversationHistory}\n`;
    
    return contextualPrompt;
}

function processStateTransition(userPrompt, aiResponse) {
    console.log(`[AskService] Processing state transition from: ${conversationState.phase}`);
    console.log(`[AskService] User prompt: ${userPrompt}`);
    console.log(`[AskService] AI Response: ${aiResponse}`);
    
    switch (conversationState.phase) {
        case 'greeting':
            // User responds to "What are you planning to design?"
            console.log('[AskService] Greeting -> Planning transition');
            updateConversationState({
                phase: 'planning',
                projectDescription: userPrompt.trim()
            });
            break;
            
        case 'planning':
            // This happens when AI responds with a task assignment
            console.log('[AskService] Planning -> Task_assigned transition');
            const firstTask = extractTaskFromResponse(aiResponse);
            console.log('[AskService] Planning phase: extracted task =', firstTask);
            updateConversationState({
                phase: 'task_assigned',
                currentTask: firstTask,
                currentTaskNumber: 1
            });
            break;
            
        case 'task_assigned':
            // User is working on task, AI gives feedback
            console.log('[AskService] Task_assigned -> Feedback transition');
            updateConversationState({
                phase: 'feedback'
            });
            break;
            
        case 'feedback':
            // Check if AI approved the task
            if (isTaskApproved(aiResponse)) {
                console.log('[AskService] Task approved, moving to next task');
                const nextTask = extractTaskFromResponse(aiResponse);
                updateConversationState({
                    phase: 'task_assigned',
                    completedTasks: [...conversationState.completedTasks, conversationState.currentTask],
                    currentTask: nextTask,
                    currentTaskNumber: conversationState.currentTaskNumber + 1
                });
            } else {
                console.log('[AskService] Task needs improvement, staying in feedback phase');
                // Still giving feedback, stay in feedback phase but update current task if needed
                const revisedTask = extractTaskFromResponse(aiResponse);
                updateConversationState({
                    phase: 'task_assigned', // Go back to task assigned to let user try again
                    currentTask: revisedTask || conversationState.currentTask
                });
            }
            break;
            
        case 'approved':
            // Should not stay here long, transitions to task_assigned
            break;
    }
}

function extractTaskFromResponse(response) {
    console.log('[AskService] Extracting task from response:', response);
    
    // Clean up markdown formatting for better extraction
    const cleanResponse = response.replace(/\*\*/g, ''); // Remove ** markdown
    
    // Enhanced extraction - look for task-like patterns
    const taskPatterns = [
        // "Task 1: Do something"
        /(?:Task|Step)\s+\d+:?\s*(.+?)(?:\.|$)/i,
        // "Let's start by doing X" - capture everything until period
        /(?:Let's start by|Let's begin by|Start by|Begin by)\s+(.+?)(?:\.|$)/i,
        // "Try changing/doing X" - capture complete instruction
        /(?:Try|Please try)\s+(.+?)(?:\.|$)/i,
        // "First, do X" or "Next, do X" - capture full instruction
        /(?:First,?|Next,?|Now,?)\s+(.+?)(?:\.|$)/i,
        // "Create X" or "Add X" or "Design X" - capture full instruction
        /(?:Create|Add|Design|Build|Make|Set up|Define|Adjust|Change)\s+(.+?)(?:\.|$)/i,
        // Direct action patterns
        /(?:You should|Go ahead and)\s+(.+?)(?:\.|$)/i
    ];
    
    for (const pattern of taskPatterns) {
        const match = cleanResponse.match(pattern);
        if (match) {
            let task = match[1].trim();
            // If the extracted task is too short, try to get more context
            if (task.length < 20) {
                // Look for the sentence containing this pattern and extract the full sentence
                const sentences = cleanResponse.split(/[.!?]+/);
                for (const sentence of sentences) {
                    if (sentence.toLowerCase().includes(task.toLowerCase().substring(0, 10))) {
                        task = sentence.trim();
                        break;
                    }
                }
            }
            console.log('[AskService] Extracted task:', task);
            return task;
        }
    }
    
    // If no specific pattern found, look for imperative sentences
    const sentences = cleanResponse.split(/[.!?]+/);
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        // Look for sentences that start with action verbs
        if (trimmed.match(/^(Create|Add|Design|Build|Make|Set|Define|Write|Draw|Place|Position|Layout|Structure|Try|Change|Adjust)/i)) {
            console.log('[AskService] Found action sentence:', trimmed);
            return trimmed;
        }
    }
    
    // Enhanced fallback: look for sentences with "let's" or task-like content
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.toLowerCase().includes('let\'s') && trimmed.length > 15) {
            console.log('[AskService] Found let\'s sentence:', trimmed);
            return trimmed;
        }
    }
    
    // Final fallback: return first meaningful sentence
    const fallback = sentences.find(s => s.trim().length > 10)?.trim() || 'Continue working on your design';
    console.log('[AskService] Using fallback task:', fallback);
    return fallback;
}

function isTaskApproved(response) {
    const lowerResponse = response.toLowerCase();
    
    // Strong approval indicators
    const approvalWords = [
        'excellent', 'perfect', 'great job', 'well done', 'nice work',
        'looks good', 'that works', 'approved', 'correct'
    ];
    
    // Next task indicators (strong sign of approval)
    const nextTaskIndicators = [
        'now let\'s', 'next', 'now we can', 'now add', 'now create',
        'now design', 'now set up', 'now try', 'move on to'
    ];
    
    // Check for strong approval
    const hasApproval = approvalWords.some(word => lowerResponse.includes(word));
    
    // Check for next task assignment (indicates previous task was approved)
    const hasNextTask = nextTaskIndicators.some(phrase => lowerResponse.includes(phrase));
    
    // Look for task numbering increase (Task 2, Step 2, etc.)
    const hasTaskProgression = /(?:task|step)\s+[2-9]/i.test(response);
    
    const isApproved = hasApproval || hasNextTask || hasTaskProgression;
    
    console.log('[AskService] Task approval check:', {
        hasApproval,
        hasNextTask,
        hasTaskProgression,
        isApproved
    });
    
    return isApproved;
}

async function sendMessage(userPrompt) {
    if (!userPrompt || userPrompt.trim().length === 0) {
        console.warn('[AskService] Cannot process empty message');
        return { success: false, error: 'Empty message' };
    }
    
    const askWindow = windowPool.get('ask');
    if (askWindow && !askWindow.isDestroyed()) {
        askWindow.webContents.send('hide-text-input');
    }

    try {
        console.log(`[AskService] 🤖 Processing message: ${userPrompt.substring(0, 50)}...`);
        console.log(`[AskService] Current state: ${conversationState.phase}`);

        const screenshotResult = await captureScreenshot({ quality: 'medium' });
        const screenshotBase64 = screenshotResult.success ? screenshotResult.base64 : null;

        const conversationHistoryRaw = getConversationHistory();
        const conversationHistory = formatConversationForPrompt(conversationHistoryRaw);

        // Build context-aware prompt based on current state
        const contextualPrompt = buildContextualPrompt(userPrompt, conversationHistory);
        const systemPrompt = getSystemPrompt('figma_design_tutor', contextualPrompt, false);

        const API_KEY = await getStoredApiKey();
        if (!API_KEY) {
            throw new Error('No API key found');
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: `User Request: ${userPrompt.trim()}` },
                ],
            },
        ];

        if (screenshotBase64) {
            messages[1].content.push({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` },
            });
        }
        
        const provider = await getStoredProvider();
        const { isLoggedIn } = authService.getCurrentUser();
        
        console.log(`[AskService] 🚀 Sending request to ${provider} AI...`);

        const streamingLLM = createStreamingLLM(provider, {
            apiKey: API_KEY,
            model: provider === 'openai' ? 'gpt-4.1' : 'gemini-2.5-flash',
            temperature: 0.7,
            maxTokens: 2048,
            usePortkey: provider === 'openai' && isLoggedIn,
            portkeyVirtualKey: isLoggedIn ? API_KEY : undefined
        });

        const response = await streamingLLM.streamChat(messages);

        // --- Stream Processing ---
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        const askWin = windowPool.get('ask');
        if (!askWin || askWin.isDestroyed()) {
            console.error("[AskService] Ask window is not available to send stream to.");
            reader.cancel();
            return;
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') {
                        askWin.webContents.send('ask-response-stream-end');
                        
                        // Process state transitions based on response
                        processStateTransition(userPrompt, fullResponse);
                        
                        // After processing user state transition, check if AI response should trigger another transition
                        if (conversationState.phase === 'planning') {
                            console.log('[AskService] AI responded in planning phase, processing task assignment');
                            processStateTransition('', fullResponse); // Empty user prompt for AI response
                        }
                        
                        // Save to DB
                        try {
                            const uid = authService.getCurrentUserId();
                            if (!uid) throw new Error("User not logged in, cannot save message.");
                            const sessionId = await sessionRepository.getOrCreateActive(uid, 'ask');
                            await askRepository.addAiMessage({ sessionId, role: 'user', content: userPrompt.trim() });
                            await askRepository.addAiMessage({ sessionId, role: 'assistant', content: fullResponse });
                            console.log(`[AskService] DB: Saved ask/answer pair to session ${sessionId}`);
                        } catch(dbError) {
                            console.error("[AskService] DB: Failed to save ask/answer pair:", dbError);
                        }
                        
                        return { success: true, response: fullResponse };
                    }
                    try {
                        const json = JSON.parse(data);
                        const token = json.choices[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                            askWin.webContents.send('ask-response-chunk', { token });
                        }
                    } catch (error) {
                        // Ignore parsing errors for now
                    }
                }
            }
        }
    } catch (error) {
        console.error('[AskService] Error processing message:', error);
        return { success: false, error: error.message };
    }
}

function initialize() {
    ipcMain.handle('ask:sendMessage', async (event, userPrompt) => {
        return sendMessage(userPrompt);
    });
    
    ipcMain.handle('ask:resetConversation', async (event) => {
        resetConversationState();
        return { success: true };
    });
    
    ipcMain.handle('ask:getConversationState', async (event) => {
        return conversationState;
    });
    
    // Debug handler to manually show task window
    ipcMain.handle('ask:showTaskWindow', async (event) => {
        showTaskWindow();
        return { success: true };
    });
    
    // Send initial task update on service start
    sendTaskUpdate();
    
    console.log('[AskService] Initialized and ready.');
}

module.exports = {
    initialize,
}; 