const { BrowserWindow, app } = require('electron');
const SttService = require('./stt/sttService');
const SummaryService = require('./summary/summaryService');
const authService = require('../../common/services/authService');
const sessionRepository = require('../../common/repositories/session');
const sttRepository = require('./stt/repositories');

class ListenService {
    constructor() {
        this.sttService = new SttService();
        this.summaryService = new SummaryService();
        this.currentSessionId = null;
        this.isInitializingSession = false;
        
        this.setupServiceCallbacks();
    }

    setupServiceCallbacks() {
        // STT service callbacks
        this.sttService.setCallbacks({
            onTranscriptionComplete: (speaker, text) => {
                this.handleTranscriptionComplete(speaker, text);
            },
            onStatusUpdate: (status) => {
                this.sendToRenderer('update-status', status);
            }
        });

        // Summary service callbacks
        this.summaryService.setCallbacks({
            onAnalysisComplete: (data) => {
                console.log('📊 Analysis completed:', data);
            },
            onStatusUpdate: (status) => {
                this.sendToRenderer('update-status', status);
            }
        });
    }

    sendToRenderer(channel, data) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        });
    }

    async handleTranscriptionComplete(speaker, text) {
        console.log(`[ListenService] Transcription complete: ${speaker} - ${text}`);
        
        // Save to database
        await this.saveConversationTurn(speaker, text);
        
        // Add to summary service for analysis
        this.summaryService.addConversationTurn(speaker, text);
    }

    async saveConversationTurn(speaker, transcription) {
        if (!this.currentSessionId) {
            console.error('[DB] Cannot save turn, no active session ID.');
            return;
        }
        if (transcription.trim() === '') return;

        try {
            await sessionRepository.touch(this.currentSessionId);
            await sttRepository.addTranscript({
                sessionId: this.currentSessionId,
                speaker: speaker,
                text: transcription.trim(),
            });
            console.log(`[DB] Saved transcript for session ${this.currentSessionId}: (${speaker})`);
        } catch (error) {
            console.error('Failed to save transcript to DB:', error);
        }
    }

    async initializeNewSession() {
        try {
            // The UID is no longer passed to the repository method directly.
            // The adapter layer handles UID injection. We just ensure a user is available.
            const user = authService.getCurrentUser();
            if (!user) {
                // This case should ideally not happen as authService initializes a default user.
                throw new Error("Cannot initialize session: auth service not ready.");
            }
            
            this.currentSessionId = await sessionRepository.getOrCreateActive('listen');
            console.log(`[DB] New listen session ensured: ${this.currentSessionId}`);

            // Set session ID for summary service
            this.summaryService.setSessionId(this.currentSessionId);
            
            // Reset conversation history
            this.summaryService.resetConversationHistory();

            console.log('New conversation session started:', this.currentSessionId);
            return true;
        } catch (error) {
            console.error('Failed to initialize new session in DB:', error);
            this.currentSessionId = null;
            return false;
        }
    }

    async initializeSession(language = 'en') {
        if (this.isInitializingSession) {
            console.log('Session initialization already in progress.');
            return false;
        }

        this.isInitializingSession = true;
        this.sendToRenderer('session-initializing', true);
        this.sendToRenderer('update-status', 'Initializing sessions...');

        try {
            // Initialize database session
            const sessionInitialized = await this.initializeNewSession();
            if (!sessionInitialized) {
                throw new Error('Failed to initialize database session');
            }

            /* ---------- STT Initialization Retry Logic ---------- */
            const MAX_RETRY = 10;
            const RETRY_DELAY_MS = 300;   // 0.3 seconds

            let sttReady = false;
            for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
                try {
                    await this.sttService.initializeSttSessions(language);
                    sttReady = true;
                    break;                         // Exit on success
                } catch (err) {
                    console.warn(
                        `[ListenService] STT init attempt ${attempt} failed: ${err.message}`
                    );
                    if (attempt < MAX_RETRY) {
                        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    }
                }
            }
            if (!sttReady) throw new Error('STT init failed after retries');
            /* ------------------------------------------- */

            console.log('✅ Listen service initialized successfully.');
            
            this.sendToRenderer('update-status', 'Connected. Ready to listen.');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize listen service:', error);
            this.sendToRenderer('update-status', 'Initialization failed.');
            return false;
        } finally {
            this.isInitializingSession = false;
            this.sendToRenderer('session-initializing', false);
            this.sendToRenderer('change-listen-capture-state', { status: "start" });
        }
    }

    async sendAudioContent(data, mimeType) {
        return await this.sttService.sendAudioContent(data, mimeType);
    }

    async startMacOSAudioCapture() {
        if (process.platform !== 'darwin') {
            throw new Error('macOS audio capture only available on macOS');
        }
        return await this.sttService.startMacOSAudioCapture();
    }

    async stopMacOSAudioCapture() {
        this.sttService.stopMacOSAudioCapture();
    }

    isSessionActive() {
        return this.sttService.isSessionActive();
    }

    async closeSession() {
        try {
            this.sendToRenderer('change-listen-capture-state', { status: "stop" });
            // Close STT sessions
            await this.sttService.closeSessions();

            // End database session
            if (this.currentSessionId) {
                await sessionRepository.end(this.currentSessionId);
                console.log(`[DB] Session ${this.currentSessionId} ended.`);
            }

            // Reset state
            this.currentSessionId = null;
            this.summaryService.resetConversationHistory();

            this.sendToRenderer('session-did-close');

            console.log('Listen service session closed.');
            return { success: true };
        } catch (error) {
            console.error('Error closing listen service session:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentSessionData() {
        return {
            sessionId: this.currentSessionId,
            conversationHistory: this.summaryService.getConversationHistory(),
            totalTexts: this.summaryService.getConversationHistory().length,
            analysisData: this.summaryService.getCurrentAnalysisData(),
        };
    }

    getConversationHistory() {
        return this.summaryService.getConversationHistory();
    }

    setupIpcHandlers() {
        const { ipcMain } = require('electron');

        ipcMain.handle('is-session-active', async () => {
            const isActive = this.isSessionActive();
            console.log(`Checking session status. Active: ${isActive}`);
            return isActive;
        });

        ipcMain.handle('initialize-openai', async (event, profile = 'interview', language = 'en') => {
            console.log(`Received initialize-openai request with profile: ${profile}, language: ${language}`);
            const success = await this.initializeSession(language);
            return success;
        });

        ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
            try {
                await this.sendAudioContent(data, mimeType);
                return { success: true };
            } catch (e) {
                console.error('Error sending user audio:', e);
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('send-system-audio-content', async (event, { data, mimeType }) => {
            try {
                await this.sttService.sendSystemAudioContent(data, mimeType);
                
                // Send system audio data back to renderer for AEC reference (like macOS does)
                this.sendToRenderer('system-audio-data', { data });
                
                return { success: true };
            } catch (error) {
                console.error('Error sending system audio:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('start-macos-audio', async () => {
            if (process.platform !== 'darwin') {
                return { success: false, error: 'macOS audio capture only available on macOS' };
            }
            if (this.sttService.isMacOSAudioRunning?.()) {
                return { success: false, error: 'already_running' };
            }

            try {
                const success = await this.startMacOSAudioCapture();
                return { success, error: null };
            } catch (error) {
                console.error('Error starting macOS audio capture:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('stop-macos-audio', async () => {
            try {
                this.stopMacOSAudioCapture();
                return { success: true };
            } catch (error) {
                console.error('Error stopping macOS audio capture:', error);
                return { success: false, error: error.message };
            }
        });

        // ipcMain.handle('close-session', async () => {
        //     return await this.closeSession();
        // });

        ipcMain.handle('update-google-search-setting', async (event, enabled) => {
            try {
                console.log('Google Search setting updated to:', enabled);
                return { success: true };
            } catch (error) {
                console.error('Error updating Google Search setting:', error);
                return { success: false, error: error.message };
            }
        });

        console.log('✅ Listen service IPC handlers registered');
    }
}

module.exports = ListenService;