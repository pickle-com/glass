const { BrowserWindow } = require('electron');
const SttService = require('./stt/sttService');
const SummaryService = require('./summary/summaryService');
const authService = require('../common/services/authService');
const sessionRepository = require('../common/repositories/session');
const sttRepository = require('./stt/repositories');
const internalBridge = require('../../bridge/internalBridge');
const EnhancedService = require('../enhanced/enhancedService');

class ListenService {
    constructor() {
        this.sttService = new SttService();
        this.summaryService = new SummaryService();
        this.enhancedService = new EnhancedService();
        this.currentSessionId = null;
        this.isInitializingSession = false;
        this.enhancedFeaturesEnabled = true; // 可通过配置控制

        this.setupServiceCallbacks();
        console.log('[ListenService] Service instance created.');
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

        // Enhanced service callbacks
        this.setupEnhancedServiceCallbacks();
    }

    setupEnhancedServiceCallbacks() {
        // 监听增强功能事件
        this.enhancedService.on('enhanced:processed', (data) => {
            console.log('🚀 Enhanced processing completed:', data.results);
            this.sendToRenderer('enhanced-update', data);
        });

        this.enhancedService.on('enhanced:translation', (data) => {
            this.sendToRenderer('translation-update', data);
        });

        this.enhancedService.on('enhanced:keywords', (data) => {
            this.sendToRenderer('keywords-update', data);
        });

        this.enhancedService.on('enhanced:definitions', (data) => {
            this.sendToRenderer('definitions-update', data);
        });

        this.enhancedService.on('enhanced:mindmap', (data) => {
            this.sendToRenderer('mindmap-update', data);
        });

        this.enhancedService.on('enhanced:highlight', (data) => {
            // 发送给浏览器扩展或其他需要的地方
            this.sendToRenderer('highlight-update', data);
        });

        this.enhancedService.on('enhanced:error', (error) => {
            console.error('Enhanced service error:', error);
            this.sendToRenderer('enhanced-error', error);
        });

        // Video learning specific events
        this.enhancedService.on('enhanced:video_session_started', (data) => {
            console.log('🎥 Video learning session started:', data);
            this.sendToRenderer('video-session-started', data);
        });

        this.enhancedService.on('enhanced:video_session_stopped', (data) => {
            console.log('⏹️ Video learning session stopped:', data);
            this.sendToRenderer('video-session-stopped', data);
        });

        this.enhancedService.on('enhanced:video_learning', (data) => {
            console.log('📚 Video learning data processed:', data);
            this.sendToRenderer('video-learning-update', data);
        });

        this.enhancedService.on('enhanced:video_error', (error) => {
            console.error('Video learning error:', error);
            this.sendToRenderer('video-error', error);
        });
    }

    sendToRenderer(channel, data) {
        const { windowPool } = require('../../window/windowManager');
        const listenWindow = windowPool?.get('listen');
        
        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.webContents.send(channel, data);
        }
    }

    initialize() {
        this.setupIpcHandlers();
        console.log('[ListenService] Initialized and ready.');
    }

    async handleListenRequest(listenButtonText) {
        const { windowPool } = require('../../window/windowManager');
        const listenWindow = windowPool.get('listen');
        const header = windowPool.get('header');

        try {
            switch (listenButtonText) {
                case 'Listen':
                    console.log('[ListenService] changeSession to "Listen"');
                    internalBridge.emit('window:requestVisibility', { name: 'listen', visible: true });
                    await this.initializeSession();
                    if (listenWindow && !listenWindow.isDestroyed()) {
                        listenWindow.webContents.send('session-state-changed', { isActive: true });
                    }
                    break;
        
                case 'Stop':
                    console.log('[ListenService] changeSession to "Stop"');
                    await this.closeSession();
                    if (listenWindow && !listenWindow.isDestroyed()) {
                        listenWindow.webContents.send('session-state-changed', { isActive: false });
                    }
                    break;
        
                case 'Done':
                    console.log('[ListenService] changeSession to "Done"');
                    internalBridge.emit('window:requestVisibility', { name: 'listen', visible: false });
                    listenWindow.webContents.send('session-state-changed', { isActive: false });
                    break;
        
                default:
                    throw new Error(`[ListenService] unknown listenButtonText: ${listenButtonText}`);
            }
            
            header.webContents.send('listen:changeSessionResult', { success: true });

        } catch (error) {
            console.error('[ListenService] error in handleListenRequest:', error);
            header.webContents.send('listen:changeSessionResult', { success: false });
            throw error; 
        }
    }

    async handleTranscriptionComplete(speaker, text) {
        console.log(`[ListenService] Transcription complete: ${speaker} - ${text}`);
        
        // Save to database
        await this.saveConversationTurn(speaker, text);
        
        // Add to summary service for analysis
        this.summaryService.addConversationTurn(speaker, text);

        // 新增：触发增强功能处理
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            try {
                const transcriptionData = {
                    speaker: speaker,
                    text: text,
                    timestamp: Date.now(),
                    sessionId: this.currentSessionId
                };
                
                await this.enhancedService.processTranscription(transcriptionData);
            } catch (error) {
                console.error('[ListenService] Enhanced processing failed:', error);
            }
        }
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

            // 新增：初始化增强服务
            if (this.enhancedFeaturesEnabled && this.enhancedService) {
                try {
                    console.log('[ListenService] Initializing enhanced services...');
                    const enhancedInitialized = await this.enhancedService.initialize();
                    if (enhancedInitialized) {
                        console.log('✅ Enhanced services initialized successfully.');
                        this.sendToRenderer('enhanced-status', 'Enhanced features ready');
                    } else {
                        console.warn('⚠️ Enhanced services initialization failed, continuing without enhanced features');
                        this.enhancedFeaturesEnabled = false;
                    }
                } catch (error) {
                    console.error('❌ Enhanced services initialization error:', error);
                    this.enhancedFeaturesEnabled = false;
                }
            }

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

    async sendMicAudioContent(data, mimeType) {
        return await this.sttService.sendMicAudioContent(data, mimeType);
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

            await this.stopMacOSAudioCapture();

            // End database session
            if (this.currentSessionId) {
                await sessionRepository.end(this.currentSessionId);
                console.log(`[DB] Session ${this.currentSessionId} ended.`);
            }

            // Reset state
            this.currentSessionId = null;
            this.summaryService.resetConversationHistory();

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

    _createHandler(asyncFn, successMessage, errorMessage) {
        return async (...args) => {
            try {
                const result = await asyncFn.apply(this, args);
                if (successMessage) console.log(successMessage);
                // `startMacOSAudioCapture`는 성공 시 { success, error } 객체를 반환하지 않으므로,
                // 핸들러가 일관된 응답을 보내도록 여기서 success 객체를 반환합니다.
                // 다른 함수들은 이미 success 객체를 반환합니다.
                return result && typeof result.success !== 'undefined' ? result : { success: true };
            } catch (e) {
                console.error(errorMessage, e);
                return { success: false, error: e.message };
            }
        };
    }

    // `_createHandler`를 사용하여 핸들러들을 동적으로 생성합니다.
    handleSendMicAudioContent = this._createHandler(
        this.sendMicAudioContent,
        null,
        'Error sending user audio:'
    );

    handleStartMacosAudio = this._createHandler(
        async () => {
            if (process.platform !== 'darwin') {
                return { success: false, error: 'macOS audio capture only available on macOS' };
            }
            if (this.sttService.isMacOSAudioRunning?.()) {
                return { success: false, error: 'already_running' };
            }
            await this.startMacOSAudioCapture();
            return { success: true, error: null };
        },
        'macOS audio capture started.',
        'Error starting macOS audio capture:'
    );
    
    handleStopMacosAudio = this._createHandler(
        this.stopMacOSAudioCapture,
        'macOS audio capture stopped.',
        'Error stopping macOS audio capture:'
    );

    handleUpdateGoogleSearchSetting = this._createHandler(
        async (enabled) => {
            console.log('Google Search setting updated to:', enabled);
        },
        null,
        'Error updating Google Search setting:'
    );

    // 新增：增强功能辅助方法
    /**
     * 处理网页内容（从浏览器扩展接收）
     * @param {object} webData - 网页数据
     */
    async handleWebContent(webData) {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            try {
                await this.enhancedService.processWebContent(webData);
            } catch (error) {
                console.error('[ListenService] Web content processing failed:', error);
            }
        }
    }

    /**
     * 获取术语定义
     * @param {string} term - 术语
     * @returns {Promise<object|null>} 定义
     */
    async getTermDefinition(term) {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            try {
                return await this.enhancedService.getTermDefinition(term, {
                    sessionId: this.currentSessionId,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('[ListenService] Failed to get term definition:', error);
                return null;
            }
        }
        return null;
    }

    /**
     * 获取当前思维导图
     * @returns {object|null} 思维导图数据
     */
    getCurrentMindMap() {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            return this.enhancedService.getCurrentMindMap();
        }
        return null;
    }

    /**
     * 设置翻译语言对
     * @param {string} source - 源语言
     * @param {string} target - 目标语言
     */
    setTranslationLanguages(source, target) {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            this.enhancedService.setLanguagePair(source, target);
        }
    }

    /**
     * 启用/禁用增强功能
     * @param {boolean} enabled - 是否启用
     */
    setEnhancedFeaturesEnabled(enabled) {
        this.enhancedFeaturesEnabled = enabled;
        if (this.enhancedService) {
            this.enhancedService.setEnabled(enabled);
        }
        console.log(`[ListenService] Enhanced features ${enabled ? 'enabled' : 'disabled'}`);
        this.sendToRenderer('enhanced-features-toggle', { enabled });
    }

    /**
     * 启用/禁用特定增强服务
     * @param {string} serviceName - 服务名称
     * @param {boolean} enabled - 是否启用
     */
    setEnhancedServiceEnabled(serviceName, enabled) {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            this.enhancedService.setServiceEnabled(serviceName, enabled);
        }
    }

    /**
     * 获取增强服务状态
     * @returns {object} 服务状态
     */
    getEnhancedServicesStatus() {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            return this.enhancedService.getServicesStatus();
        }
        return { enhanced: { isEnabled: false } };
    }

    /**
     * 清除所有增强数据
     */
    clearEnhancedData() {
        if (this.enhancedFeaturesEnabled && this.enhancedService) {
            this.enhancedService.clearAll();
            this.sendToRenderer('enhanced-data-cleared', { timestamp: Date.now() });
        }
    }
}

const listenService = new ListenService();
module.exports = listenService;