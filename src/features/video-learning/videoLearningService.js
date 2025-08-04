const { EventEmitter } = require('events');
const ScreenCaptureService = require('./capture/screenCaptureService');
const OCRService = require('./ocr/ocrService');
const FrameAnalyzer = require('./analysis/frameAnalyzer');

/**
 * 视频学习服务
 * 集成屏幕捕获、OCR识别和内容分析功能
 */
class VideoLearningService extends EventEmitter {
    constructor() {
        super();
        
        // 初始化子服务
        this.screenCapture = new ScreenCaptureService();
        this.ocrService = new OCRService();
        this.frameAnalyzer = new FrameAnalyzer();
        
        // 服务状态
        this.isActive = false;
        this.isInitialized = false;
        this.currentSession = null;
        
        // 配置参数
        this.config = {
            enabled: false,
            captureRate: 0.5, // 每2秒捕获一帧
            ocrEnabled: true,
            autoStart: false,
            qualityLevel: 'medium', // low, medium, high
            languages: ['eng', 'chi_sim']
        };
        
        // 性能统计
        this.stats = {
            sessionsCount: 0,
            framesProcessed: 0,
            textExtracted: 0,
            totalProcessingTime: 0,
            averageAccuracy: 0,
            lastSessionDuration: 0
        };
        
        // 设置事件监听
        this.setupEventListeners();
        
        console.log('[VideoLearningService] Service initialized');
    }

    /**
     * 初始化视频学习服务
     */
    async initialize() {
        try {
            console.log('[VideoLearningService] Starting initialization...');
            
            // 初始化OCR服务
            if (!this.ocrService.isInitialized) {
                console.log('[VideoLearningService] Initializing OCR service...');
                await this.ocrService.initializeEngines();
            }
            
            this.isInitialized = true;
            this.emit('service:initialized');
            
            console.log('[VideoLearningService] ✅ Service initialized successfully');
            return true;
            
        } catch (error) {
            console.error('[VideoLearningService] ❌ Initialization failed:', error);
            this.emit('service:error', { error: error.message });
            return false;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 屏幕捕获事件
        this.screenCapture.on('capture:started', (data) => {
            console.log('[VideoLearningService] Screen capture started');
            this.emit('video:capture_started', data);
        });

        this.screenCapture.on('capture:stopped', () => {
            console.log('[VideoLearningService] Screen capture stopped');
            this.emit('video:capture_stopped');
        });

        this.screenCapture.on('frame:extracted', async (frameData) => {
            await this.handleFrameExtracted(frameData);
        });

        this.screenCapture.on('capture:error', (error) => {
            console.error('[VideoLearningService] Capture error:', error);
            this.emit('video:error', error);
        });

        // OCR服务事件
        this.ocrService.on('ocr:completed', (result) => {
            this.stats.textExtracted++;
            this.emit('video:text_extracted', result);
        });

        this.ocrService.on('ocr:error', (error) => {
            console.error('[VideoLearningService] OCR error:', error);
        });

        // 帧分析器事件
        this.frameAnalyzer.on('frame:analyzed', (analysis) => {
            this.emit('video:frame_analyzed', analysis);
        });
    }

    /**
     * 开始视频学习会话
     * @param {object} options - 会话选项
     * @returns {Promise<boolean>} 是否成功开始
     */
    async startVideoLearning(options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('Service not initialized');
            }

            if (this.isActive) {
                console.warn('[VideoLearningService] Video learning already active');
                return true;
            }

            console.log('[VideoLearningService] Starting video learning session...');

            // 合并配置
            const sessionConfig = { ...this.config, ...options };
            
            // 创建新会话
            this.currentSession = {
                id: this.generateSessionId(),
                startTime: Date.now(),
                config: sessionConfig,
                stats: {
                    framesProcessed: 0,
                    textExtracted: 0,
                    processingTime: 0
                }
            };

            // 配置屏幕捕获
            const captureConfig = {
                frameRate: sessionConfig.captureRate,
                maxWidth: sessionConfig.qualityLevel === 'high' ? 1920 : 
                         sessionConfig.qualityLevel === 'medium' ? 1280 : 640,
                maxHeight: sessionConfig.qualityLevel === 'high' ? 1080 : 
                          sessionConfig.qualityLevel === 'medium' ? 720 : 480
            };

            // 开始屏幕捕获
            const captureStarted = await this.screenCapture.startCapture(captureConfig);
            if (!captureStarted) {
                throw new Error('Failed to start screen capture');
            }

            // 配置OCR服务
            this.ocrService.updateConfig({
                languages: sessionConfig.languages,
                confidence: 60
            });

            this.isActive = true;
            this.stats.sessionsCount++;
            
            this.emit('video:session_started', {
                sessionId: this.currentSession.id,
                config: sessionConfig
            });
            
            console.log('[VideoLearningService] ✅ Video learning session started');
            return true;

        } catch (error) {
            console.error('[VideoLearningService] ❌ Failed to start video learning:', error);
            this.emit('video:error', { error: error.message });
            return false;
        }
    }

    /**
     * 停止视频学习会话
     */
    async stopVideoLearning() {
        try {
            if (!this.isActive) {
                return;
            }

            console.log('[VideoLearningService] Stopping video learning session...');

            // 停止屏幕捕获
            await this.screenCapture.stopCapture();

            // 更新会话统计
            if (this.currentSession) {
                this.currentSession.endTime = Date.now();
                this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
                this.stats.lastSessionDuration = this.currentSession.duration;
                
                // 更新全局统计
                this.stats.framesProcessed += this.currentSession.stats.framesProcessed;
                this.stats.totalProcessingTime += this.currentSession.stats.processingTime;
            }

            this.isActive = false;
            
            this.emit('video:session_stopped', {
                sessionId: this.currentSession?.id,
                duration: this.currentSession?.duration,
                stats: this.currentSession?.stats
            });

            this.currentSession = null;
            
            console.log('[VideoLearningService] ✅ Video learning session stopped');

        } catch (error) {
            console.error('[VideoLearningService] Error stopping video learning:', error);
            this.emit('video:error', { error: error.message });
        }
    }

    /**
     * 处理提取的帧
     * @param {object} frameData - 帧数据
     */
    async handleFrameExtracted(frameData) {
        try {
            if (!this.isActive || !this.config.ocrEnabled) {
                return;
            }

            const startTime = Date.now();

            // 帧分析 - 决定是否需要OCR处理
            const analysis = await this.frameAnalyzer.analyzeFrame(frameData.data, {
                width: frameData.width,
                height: frameData.height,
                timestamp: frameData.timestamp
            });

            if (!analysis.shouldProcess) {
                console.log(`[VideoLearningService] Skipping frame: ${analysis.reason}`);
                return;
            }

            console.log('[VideoLearningService] Processing frame for OCR...');

            // 执行OCR
            const ocrResult = await this.ocrService.extractText(frameData.data, {
                languages: this.config.languages
            });

            const processingTime = Date.now() - startTime;

            // 更新会话统计
            if (this.currentSession) {
                this.currentSession.stats.framesProcessed++;
                this.currentSession.stats.processingTime += processingTime;
            }

            // 如果提取到有意义的文本，发送处理事件
            if (ocrResult.text && ocrResult.text.length > 20) {
                console.log(`[VideoLearningService] Text extracted: ${ocrResult.text.substring(0, 50)}...`);
                
                if (this.currentSession) {
                    this.currentSession.stats.textExtracted++;
                }

                // 发送到增强服务进行进一步处理
                this.emit('video:text_ready', {
                    text: ocrResult.text,
                    confidence: ocrResult.confidence,
                    timestamp: frameData.timestamp,
                    sessionId: this.currentSession?.id,
                    source: 'video_ocr',
                    metadata: {
                        engine: ocrResult.engine,
                        processingTime: processingTime,
                        frameSize: `${frameData.width}x${frameData.height}`
                    }
                });
            }

        } catch (error) {
            console.error('[VideoLearningService] Frame processing failed:', error);
            this.emit('video:frame_error', { error: error.message });
        }
    }

    /**
     * 手动捕获和处理当前帧
     * @returns {Promise<object>} 处理结果
     */
    async captureCurrentFrame() {
        try {
            if (!this.isActive) {
                throw new Error('Video learning not active');
            }

            console.log('[VideoLearningService] Manual frame capture requested...');

            const frameData = await this.screenCapture.captureFrame();
            if (!frameData) {
                throw new Error('Failed to capture frame');
            }

            const ocrResult = await this.ocrService.extractText(frameData);
            
            return {
                success: true,
                text: ocrResult.text,
                confidence: ocrResult.confidence,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[VideoLearningService] Manual capture failed:', error);
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 切换视频学习状态
     * @returns {Promise<boolean>} 新的状态
     */
    async toggleVideoLearning() {
        if (this.isActive) {
            await this.stopVideoLearning();
            return false;
        } else {
            const started = await this.startVideoLearning();
            return started;
        }
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        console.log('[VideoLearningService] Configuration updated:', {
            old: oldConfig,
            new: this.config
        });

        // 如果正在运行，应用某些配置更改
        if (this.isActive) {
            if (newConfig.captureRate && newConfig.captureRate !== oldConfig.captureRate) {
                this.screenCapture.updateConfig({ frameRate: newConfig.captureRate });
            }
            
            if (newConfig.languages && JSON.stringify(newConfig.languages) !== JSON.stringify(oldConfig.languages)) {
                this.ocrService.updateConfig({ languages: newConfig.languages });
            }
        }

        this.emit('config:updated', this.config);
    }

    /**
     * 启用/禁用服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        
        if (!enabled && this.isActive) {
            this.stopVideoLearning();
        }
        
        console.log(`[VideoLearningService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 获取可用屏幕列表
     * @returns {Promise<Array>} 屏幕列表
     */
    async getAvailableScreens() {
        return await this.screenCapture.getAvailableScreens();
    }

    /**
     * 生成会话ID
     * @returns {string} 会话ID
     */
    generateSessionId() {
        return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取服务状态
     * @returns {object} 状态信息
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isActive: this.isActive,
            config: this.config,
            currentSession: this.currentSession ? {
                id: this.currentSession.id,
                startTime: this.currentSession.startTime,
                duration: Date.now() - this.currentSession.startTime,
                stats: this.currentSession.stats
            } : null,
            services: {
                screenCapture: this.screenCapture.getStatus(),
                ocr: this.ocrService.getStatus(),
                frameAnalyzer: this.frameAnalyzer.getStatus()
            }
        };
    }

    /**
     * 获取性能统计
     * @returns {object} 性能信息
     */
    getPerformanceStats() {
        const baseStats = {
            ...this.stats,
            averageProcessingTime: this.stats.framesProcessed > 0 ? 
                this.stats.totalProcessingTime / this.stats.framesProcessed : 0
        };

        return {
            ...baseStats,
            services: {
                screenCapture: this.screenCapture.getPerformanceStats(),
                ocr: this.ocrService.getPerformanceStats(),
                frameAnalyzer: this.frameAnalyzer.getStats()
            },
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 重置统计数据
     */
    resetStats() {
        this.stats = {
            sessionsCount: 0,
            framesProcessed: 0,
            textExtracted: 0,
            totalProcessingTime: 0,
            averageAccuracy: 0,
            lastSessionDuration: 0
        };
        
        this.frameAnalyzer.resetStats();
        this.ocrService.clearCache();
        
        console.log('[VideoLearningService] Statistics reset');
        this.emit('stats:reset');
    }

    /**
     * 清理资源
     */
    async cleanup() {
        try {
            if (this.isActive) {
                await this.stopVideoLearning();
            }
            
            this.screenCapture.destroy();
            this.ocrService.destroy();
            this.removeAllListeners();
            
            console.log('[VideoLearningService] Cleanup completed');
        } catch (error) {
            console.error('[VideoLearningService] Cleanup error:', error);
        }
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.cleanup();
        console.log('[VideoLearningService] Service destroyed');
    }
}

module.exports = VideoLearningService;