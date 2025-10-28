const { EventEmitter } = require('events');
const TranslationService = require('../translation/translationService');
const KeywordService = require('../keywords/keywordService');
const GlossaryService = require('../glossary/glossaryService');
const MindMapService = require('../mindmap/mindMapService');
const VideoLearningService = require('../video-learning/videoLearningService');

/**
 * 增强功能集成服务
 * 协调所有新增功能的运行和交互
 */
class EnhancedService extends EventEmitter {
    constructor() {
        super();
        
        // 初始化所有子服务
        this.translationService = new TranslationService();
        this.keywordService = new KeywordService();
        this.glossaryService = new GlossaryService();
        this.mindMapService = new MindMapService();
        this.videoLearningService = new VideoLearningService();
        
        // 服务状态
        this.isEnabled = false;
        this.isInitialized = false;
        
        // 处理队列
        this.processingQueue = [];
        this.isProcessing = false;
        
        // 配置
        this.config = {
            batchProcessing: true,
            parallelProcessing: true,
            updateInterval: 1000,
            maxQueueSize: 100
        };

        // 设置事件监听
        this.setupEventListeners();
        
        console.log('[EnhancedService] Service initialized');
    }

    /**
     * 初始化增强服务
     */
    async initialize() {
        try {
            console.log('[EnhancedService] Starting initialization...');
            
            // 并行初始化所有子服务
            const initPromises = [
                this.translationService.initialize(),
                this.keywordService.initialize(),
                this.glossaryService.initialize(),
                this.mindMapService.initialize(),
                this.videoLearningService.initialize()
            ];

            const results = await Promise.all(initPromises);
            const allSuccessful = results.every(result => result === true);

            if (allSuccessful) {
                this.isInitialized = true;
                this.isEnabled = true;
                console.log('[EnhancedService] All services initialized successfully');
                this.emit('service:ready');
                return true;
            } else {
                console.error('[EnhancedService] Some services failed to initialize');
                return false;
            }

        } catch (error) {
            console.error('[EnhancedService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听翻译服务事件
        this.translationService.on('translation:complete', (data) => {
            this.emit('enhanced:translation', data);
        });

        // 监听关键词服务事件
        this.keywordService.on('keywords:extracted', (data) => {
            this.emit('enhanced:keywords', data);
            // 自动为关键词获取定义
            this.processKeywordsForDefinitions(data.keywords);
        });

        // 监听术语服务事件
        this.glossaryService.on('definition:retrieved', (data) => {
            this.emit('enhanced:definition', data);
        });

        // 监听思维导图服务事件
        this.mindMapService.on('mindmap:updated', (data) => {
            this.emit('enhanced:mindmap', data);
        });

        // 监听视频学习服务事件
        this.videoLearningService.on('video:text_ready', (data) => {
            // 将视频OCR提取的文本作为转录内容处理
            this.processVideoOCRText(data);
        });

        this.videoLearningService.on('video:session_started', (data) => {
            this.emit('enhanced:video_session_started', data);
        });

        this.videoLearningService.on('video:session_stopped', (data) => {
            this.emit('enhanced:video_session_stopped', data);
        });

        this.videoLearningService.on('video:error', (data) => {
            this.emit('enhanced:video_error', data);
        });
    }

    /**
     * 处理转录更新（主要入口点）
     * @param {object} transcriptionData - 转录数据
     */
    async processTranscription(transcriptionData) {
        if (!this.isEnabled || !this.isInitialized) {
            return;
        }

        try {
            const { speaker, text, timestamp, sessionId } = transcriptionData;
            
            console.log(`[EnhancedService] Processing transcription: ${text.substring(0, 50)}...`);

            // 创建处理任务
            const processingTask = {
                id: this.generateTaskId(),
                type: 'transcription',
                data: { speaker, text, timestamp, sessionId },
                timestamp: Date.now()
            };

            // 添加到处理队列
            this.addToQueue(processingTask);

            // 如果启用并行处理，立即处理
            if (this.config.parallelProcessing && !this.isProcessing) {
                this.processQueue();
            }

        } catch (error) {
            console.error('[EnhancedService] Failed to process transcription:', error);
        }
    }

    /**
     * 处理视频OCR提取的文本
     * @param {object} ocrData - OCR数据
     */
    async processVideoOCRText(ocrData) {
        if (!this.isEnabled || !this.isInitialized) {
            return;
        }

        try {
            const { text, confidence, timestamp, sessionId, source, metadata } = ocrData;
            
            console.log(`[EnhancedService] Processing video OCR text: ${text.substring(0, 50)}...`);

            // 创建处理任务
            const processingTask = {
                id: this.generateTaskId(),
                type: 'video_ocr',
                data: { 
                    text, 
                    confidence, 
                    timestamp, 
                    sessionId, 
                    source,
                    metadata
                },
                timestamp: Date.now()
            };

            // 添加到处理队列
            this.addToQueue(processingTask);

            // 处理队列
            if (!this.isProcessing) {
                this.processQueue();
            }

        } catch (error) {
            console.error('[EnhancedService] Failed to process video OCR text:', error);
        }
    }

    /**
     * 处理网页内容
     * @param {object} webData - 网页数据
     */
    async processWebContent(webData) {
        if (!this.isEnabled || !this.isInitialized) {
            return;
        }

        try {
            const { content, url, title, timestamp } = webData;
            
            console.log(`[EnhancedService] Processing web content from: ${url}`);

            // 创建处理任务
            const processingTask = {
                id: this.generateTaskId(),
                type: 'web_content',
                data: { content, url, title, timestamp },
                timestamp: Date.now()
            };

            // 添加到处理队列
            this.addToQueue(processingTask);

            // 处理队列
            if (!this.isProcessing) {
                this.processQueue();
            }

        } catch (error) {
            console.error('[EnhancedService] Failed to process web content:', error);
        }
    }

    /**
     * 添加任务到队列
     * @param {object} task - 处理任务
     */
    addToQueue(task) {
        if (this.processingQueue.length >= this.config.maxQueueSize) {
            // 移除最旧的任务
            this.processingQueue.shift();
        }
        
        this.processingQueue.push(task);
        this.emit('queue:added', { taskId: task.id, queueSize: this.processingQueue.length });
    }

    /**
     * 处理队列
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        
        try {
            while (this.processingQueue.length > 0) {
                const task = this.processingQueue.shift();
                await this.processTask(task);
            }
        } catch (error) {
            console.error('[EnhancedService] Queue processing error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 处理单个任务
     * @param {object} task - 任务
     */
    async processTask(task) {
        try {
            const { type, data } = task;
            const text = type === 'transcription' ? data.text : 
                        type === 'video_ocr' ? data.text : data.content;
            
            if (!text || text.trim().length === 0) {
                return;
            }

            // 准备上下文信息
            const context = {
                type: type,
                timestamp: data.timestamp,
                sessionId: data.sessionId,
                url: data.url,
                title: data.title,
                speaker: data.speaker,
                confidence: data.confidence,
                source: data.source,
                metadata: data.metadata
            };

            // 并行处理所有增强功能
            const processingPromises = [];

            // 1. 翻译处理
            if (this.translationService.isEnabled) {
                processingPromises.push(
                    this.translationService.translateText(text).catch(error => {
                        console.error('[EnhancedService] Translation failed:', error);
                        return null;
                    })
                );
            }

            // 2. 关键词提取
            if (this.keywordService.isEnabled) {
                processingPromises.push(
                    this.keywordService.extractKeywords(text, context).catch(error => {
                        console.error('[EnhancedService] Keyword extraction failed:', error);
                        return [];
                    })
                );
            }

            // 3. 思维导图更新
            if (this.mindMapService.isEnabled) {
                processingPromises.push(
                    this.mindMapService.updateMindMap(text).catch(error => {
                        console.error('[EnhancedService] MindMap update failed:', error);
                        return null;
                    })
                );
            }

            // 等待所有处理完成
            const [translation, keywords, mindMap] = await Promise.all(processingPromises);

            // 发送综合结果
            const enhancedData = {
                taskId: task.id,
                originalText: text,
                context: context,
                results: {
                    translation: translation,
                    keywords: keywords,
                    mindMap: mindMap ? this.mindMapService.generateVisualization() : null
                },
                timestamp: Date.now()
            };

            this.emit('enhanced:processed', enhancedData);
            
            // 如果是网页内容，发送高亮信息
            if (type === 'web_content' && keywords && keywords.length > 0) {
                this.emit('enhanced:highlight', {
                    url: data.url,
                    keywords: keywords.map(k => k.word),
                    timestamp: Date.now()
                });
            }

            // 如果是视频OCR内容，发送视频学习增强数据
            if (type === 'video_ocr' && (translation || keywords)) {
                this.emit('enhanced:video_learning', {
                    sessionId: data.sessionId,
                    originalText: text,
                    translation: translation,
                    keywords: keywords,
                    confidence: data.confidence,
                    timestamp: Date.now(),
                    metadata: data.metadata
                });
            }

        } catch (error) {
            console.error('[EnhancedService] Task processing failed:', error);
            this.emit('enhanced:error', { taskId: task.id, error: error.message });
        }
    }

    /**
     * 为关键词自动获取定义
     * @param {Array<object>} keywords - 关键词列表
     */
    async processKeywordsForDefinitions(keywords) {
        if (!this.glossaryService.isEnabled || !keywords || keywords.length === 0) {
            return;
        }

        try {
            // 只处理高重要性的关键词
            const importantKeywords = keywords
                .filter(k => k.importance === 'high' || k.score > 1.0)
                .slice(0, 5); // 限制数量

            if (importantKeywords.length === 0) {
                return;
            }

            const terms = importantKeywords.map(k => k.word);
            const definitions = await this.glossaryService.batchGetDefinitions(terms);

            if (definitions.size > 0) {
                this.emit('enhanced:definitions', {
                    definitions: Object.fromEntries(definitions),
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[EnhancedService] Failed to process keywords for definitions:', error);
        }
    }

    /**
     * 获取特定术语的定义
     * @param {string} term - 术语
     * @param {object} context - 上下文
     * @returns {Promise<object|null>} 定义
     */
    async getTermDefinition(term, context = {}) {
        if (!this.glossaryService.isEnabled) {
            return null;
        }

        try {
            return await this.glossaryService.getDefinition(term, context);
        } catch (error) {
            console.error('[EnhancedService] Failed to get term definition:', error);
            return null;
        }
    }

    /**
     * 获取当前思维导图
     * @returns {object|null} 思维导图可视化数据
     */
    getCurrentMindMap() {
        if (!this.mindMapService.isEnabled) {
            return null;
        }

        return this.mindMapService.generateVisualization();
    }

    /**
     * 开始视频学习会话
     * @param {object} options - 视频学习选项
     * @returns {Promise<boolean>} 是否成功开始
     */
    async startVideoLearning(options = {}) {
        if (!this.videoLearningService.isInitialized) {
            console.warn('[EnhancedService] Video learning service not initialized');
            return false;
        }

        return await this.videoLearningService.startVideoLearning(options);
    }

    /**
     * 停止视频学习会话
     * @returns {Promise<void>}
     */
    async stopVideoLearning() {
        if (!this.videoLearningService.isInitialized) {
            return;
        }

        await this.videoLearningService.stopVideoLearning();
    }

    /**
     * 切换视频学习状态
     * @returns {Promise<boolean>} 新的状态
     */
    async toggleVideoLearning() {
        if (!this.videoLearningService.isInitialized) {
            return false;
        }

        return await this.videoLearningService.toggleVideoLearning();
    }

    /**
     * 手动捕获当前帧
     * @returns {Promise<object>} 捕获结果
     */
    async captureCurrentFrame() {
        if (!this.videoLearningService.isInitialized) {
            return { success: false, error: 'Video learning service not initialized' };
        }

        return await this.videoLearningService.captureCurrentFrame();
    }

    /**
     * 获取视频学习统计
     * @returns {object} 统计信息
     */
    getVideoLearningStats() {
        if (!this.videoLearningService.isInitialized) {
            return null;
        }

        return this.videoLearningService.getPerformanceStats();
    }

    /**
     * 获取可用屏幕列表
     * @returns {Promise<Array>} 屏幕列表
     */
    async getAvailableScreens() {
        if (!this.videoLearningService.isInitialized) {
            return [];
        }

        return await this.videoLearningService.getAvailableScreens();
    }

    /**
     * 设置语言对
     * @param {string} source - 源语言
     * @param {string} target - 目标语言
     */
    setLanguagePair(source, target) {
        if (this.translationService.isEnabled) {
            this.translationService.setLanguagePair(source, target);
        }
    }

    /**
     * 启用/禁用特定服务
     * @param {string} serviceName - 服务名称
     * @param {boolean} enabled - 是否启用
     */
    setServiceEnabled(serviceName, enabled) {
        const serviceMap = {
            'translation': this.translationService,
            'keywords': this.keywordService,
            'glossary': this.glossaryService,
            'mindmap': this.mindMapService,
            'video': this.videoLearningService
        };

        const service = serviceMap[serviceName];
        if (service && typeof service.setEnabled === 'function') {
            service.setEnabled(enabled);
            console.log(`[EnhancedService] ${serviceName} service ${enabled ? 'enabled' : 'disabled'}`);
            this.emit('service:toggled', { service: serviceName, enabled });
        }
    }

    /**
     * 获取所有服务状态
     * @returns {object} 服务状态
     */
    getServicesStatus() {
        return {
            enhanced: {
                isEnabled: this.isEnabled,
                isInitialized: this.isInitialized,
                queueSize: this.processingQueue.length,
                isProcessing: this.isProcessing
            },
            translation: this.translationService.getStatus(),
            keywords: this.keywordService.getStatus(),
            glossary: this.glossaryService.getStatistics(),
            mindmap: this.mindMapService.getStatus(),
            video: this.videoLearningService.getStatus()
        };
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[EnhancedService] Configuration updated:', this.config);
        this.emit('config:updated', this.config);
    }

    /**
     * 清除所有缓存和状态
     */
    clearAll() {
        // 清除队列
        this.processingQueue = [];
        
        // 清除各服务的缓存
        if (this.translationService.clearCache) {
            this.translationService.clearCache();
        }
        
        if (this.glossaryService.clearAllCache) {
            this.glossaryService.clearAllCache();
        }
        
        if (this.mindMapService.clearMindMap) {
            this.mindMapService.clearMindMap();
        }

        console.log('[EnhancedService] All data cleared');
        this.emit('enhanced:cleared');
    }

    /**
     * 启用/禁用整个服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        // 同时控制所有子服务
        if (this.isInitialized) {
            this.translationService.setEnabled(enabled);
            this.keywordService.setEnabled(enabled);
            this.glossaryService.setEnabled(enabled);
            this.mindMapService.setEnabled(enabled);
            this.videoLearningService.setEnabled(enabled);
        }

        console.log(`[EnhancedService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 导出所有增强数据
     * @returns {object} 导出数据
     */
    exportData() {
        return {
            mindMap: this.mindMapService.exportMindMap('json'),
            glossary: this.glossaryService.exportDefinitions(),
            config: this.config,
            timestamp: Date.now()
        };
    }

    /**
     * 生成任务ID
     * @returns {string} 任务ID
     */
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取处理统计
     * @returns {object} 统计信息
     */
    getStatistics() {
        return {
            totalTasksProcessed: this.totalTasksProcessed || 0,
            queueSize: this.processingQueue.length,
            isProcessing: this.isProcessing,
            uptime: Date.now() - (this.startTime || Date.now()),
            servicesStatus: this.getServicesStatus()
        };
    }
}

module.exports = EnhancedService;