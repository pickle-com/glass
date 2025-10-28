const { EventEmitter } = require('events');

/**
 * OCR (光学字符识别) 服务
 * 支持多种OCR引擎的统一接口
 */
class OCRService extends EventEmitter {
    constructor() {
        super();
        
        this.isInitialized = false;
        this.currentEngine = 'mock'; // 'mock', 'tesseract', 'native'
        this.engines = new Map();
        this.cache = new Map();
        this.maxCacheSize = 100;
        
        // 配置参数
        this.config = {
            languages: ['eng', 'chi_sim'], // 英文和简体中文
            confidence: 60, // 最低置信度阈值
            preprocessing: true, // 是否进行图像预处理
            caching: true // 是否启用缓存
        };
        
        this.initializeEngines();
        console.log('[OCRService] Service initialized');
    }

    /**
     * 初始化OCR引擎
     */
    async initializeEngines() {
        try {
            // 注册模拟OCR引擎（用于测试和演示）
            this.engines.set('mock', new MockOCREngine());
            
            // 尝试加载Tesseract.js（如果可用）
            try {
                const TesseractEngine = require('./engines/tesseractEngine');
                this.engines.set('tesseract', new TesseractEngine());
                console.log('[OCRService] Tesseract engine available');
            } catch (error) {
                console.log('[OCRService] Tesseract engine not available');
            }

            // 尝试加载原生OCR引擎（如果可用）
            try {
                const NativeEngine = require('./engines/nativeEngine');
                this.engines.set('native', new NativeEngine());
                console.log('[OCRService] Native engine available');
            } catch (error) {
                console.log('[OCRService] Native engine not available');
            }

            // 选择最佳可用引擎
            await this.selectBestEngine();
            
            this.isInitialized = true;
            this.emit('ocr:initialized', { engine: this.currentEngine });
            
        } catch (error) {
            console.error('[OCRService] Failed to initialize engines:', error);
            this.emit('ocr:error', { error: error.message });
        }
    }

    /**
     * 选择最佳可用的OCR引擎
     */
    async selectBestEngine() {
        const enginePriority = ['native', 'tesseract', 'mock'];
        
        for (const engineName of enginePriority) {
            if (this.engines.has(engineName)) {
                const engine = this.engines.get(engineName);
                try {
                    if (await engine.isAvailable()) {
                        this.currentEngine = engineName;
                        console.log(`[OCRService] Selected engine: ${engineName}`);
                        return;
                    }
                } catch (error) {
                    console.warn(`[OCRService] Engine ${engineName} unavailable:`, error.message);
                }
            }
        }
        
        // 回退到模拟引擎
        this.currentEngine = 'mock';
        console.log('[OCRService] Fallback to mock engine');
    }

    /**
     * 从图像中提取文字
     * @param {string} imageData - Base64编码的图像数据
     * @param {object} options - OCR选项
     * @returns {Promise<object>} OCR结果
     */
    async extractText(imageData, options = {}) {
        if (!this.isInitialized) {
            throw new Error('OCR service not initialized');
        }

        try {
            // 生成缓存键
            const cacheKey = this.generateCacheKey(imageData, options);
            
            // 检查缓存
            if (this.config.caching && this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                this.emit('ocr:cache_hit', { cacheKey });
                return cached;
            }

            // 合并配置
            const ocrOptions = { ...this.config, ...options };

            // 图像预处理
            let processedImage = imageData;
            if (ocrOptions.preprocessing) {
                processedImage = await this.preprocessImage(imageData);
            }

            // 执行OCR
            const engine = this.engines.get(this.currentEngine);
            if (!engine) {
                throw new Error(`OCR engine ${this.currentEngine} not found`);
            }

            console.log(`[OCRService] Processing with ${this.currentEngine} engine...`);
            const startTime = Date.now();
            
            const result = await engine.extractText(processedImage, ocrOptions);
            
            const processingTime = Date.now() - startTime;
            console.log(`[OCRService] OCR completed in ${processingTime}ms`);

            // 后处理结果
            const processedResult = this.postprocessResult(result, ocrOptions);

            // 缓存结果
            if (this.config.caching && processedResult.confidence >= ocrOptions.confidence) {
                this.cacheResult(cacheKey, processedResult);
            }

            // 发送事件
            this.emit('ocr:completed', {
                engine: this.currentEngine,
                processingTime,
                confidence: processedResult.confidence,
                textLength: processedResult.text.length
            });

            return processedResult;

        } catch (error) {
            console.error('[OCRService] Text extraction failed:', error);
            this.emit('ocr:error', { error: error.message });
            
            // 返回空结果而不是抛出异常
            return {
                text: '',
                confidence: 0,
                engine: this.currentEngine,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 批量OCR处理
     * @param {Array<string>} imageDataArray - 图像数据数组
     * @param {object} options - OCR选项
     * @returns {Promise<Array<object>>} OCR结果数组
     */
    async extractTextBatch(imageDataArray, options = {}) {
        const results = [];
        
        for (let i = 0; i < imageDataArray.length; i++) {
            try {
                const result = await this.extractText(imageDataArray[i], options);
                results.push(result);
                
                // 发送进度事件
                this.emit('ocr:batch_progress', {
                    current: i + 1,
                    total: imageDataArray.length,
                    progress: ((i + 1) / imageDataArray.length) * 100
                });
                
            } catch (error) {
                results.push({
                    text: '',
                    confidence: 0,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        return results;
    }

    /**
     * 图像预处理
     * @param {string} imageData - 图像数据
     * @returns {Promise<string>} 处理后的图像数据
     */
    async preprocessImage(imageData) {
        try {
            // 这里可以添加图像预处理逻辑
            // 例如：对比度增强、去噪、锐化等
            // 目前直接返回原图像
            return imageData;
        } catch (error) {
            console.warn('[OCRService] Image preprocessing failed:', error);
            return imageData;
        }
    }

    /**
     * 后处理OCR结果
     * @param {object} result - 原始OCR结果
     * @param {object} options - 选项
     * @returns {object} 处理后的结果
     */
    postprocessResult(result, options) {
        let processedText = result.text || '';
        
        // 清理文本
        processedText = processedText
            .replace(/\s+/g, ' ') // 合并多个空格
            .replace(/\n\s*\n/g, '\n\n') // 标准化换行
            .trim();

        // 过滤低置信度结果
        if (result.confidence < options.confidence) {
            processedText = '';
        }

        return {
            text: processedText,
            confidence: result.confidence || 0,
            engine: this.currentEngine,
            originalLength: (result.text || '').length,
            processedLength: processedText.length,
            timestamp: Date.now(),
            metadata: result.metadata || {}
        };
    }

    /**
     * 生成缓存键
     * @param {string} imageData - 图像数据
     * @param {object} options - 选项
     * @returns {string} 缓存键
     */
    generateCacheKey(imageData, options) {
        // 使用图像数据的哈希和选项生成键
        const imageHash = this.simpleHash(imageData);
        const optionsHash = this.simpleHash(JSON.stringify(options));
        return `${imageHash}_${optionsHash}`;
    }

    /**
     * 简单哈希函数
     * @param {string} str - 输入字符串
     * @returns {string} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 缓存结果
     * @param {string} key - 缓存键
     * @param {object} result - 结果
     */
    cacheResult(key, result) {
        // 限制缓存大小
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, result);
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('[OCRService] Cache cleared');
        this.emit('ocr:cache_cleared');
    }

    /**
     * 切换OCR引擎
     * @param {string} engineName - 引擎名称
     * @returns {Promise<boolean>} 是否切换成功
     */
    async switchEngine(engineName) {
        if (!this.engines.has(engineName)) {
            console.error(`[OCRService] Engine ${engineName} not available`);
            return false;
        }

        const engine = this.engines.get(engineName);
        if (!(await engine.isAvailable())) {
            console.error(`[OCRService] Engine ${engineName} not ready`);
            return false;
        }

        this.currentEngine = engineName;
        console.log(`[OCRService] Switched to ${engineName} engine`);
        this.emit('ocr:engine_switched', { engine: engineName });
        return true;
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[OCRService] Configuration updated:', this.config);
        this.emit('ocr:config_updated', this.config);
    }

    /**
     * 获取服务状态
     * @returns {object} 状态信息
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentEngine: this.currentEngine,
            availableEngines: Array.from(this.engines.keys()),
            cacheSize: this.cache.size,
            config: this.config
        };
    }

    /**
     * 获取性能统计
     * @returns {object} 性能信息
     */
    getPerformanceStats() {
        return {
            cacheHits: this.cacheHits || 0,
            totalRequests: this.totalRequests || 0,
            averageProcessingTime: this.averageProcessingTime || 0,
            cacheSize: this.cache.size,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.clearCache();
        this.engines.clear();
        this.removeAllListeners();
        console.log('[OCRService] Service destroyed');
    }
}

/**
 * 模拟OCR引擎（用于测试和演示）
 */
class MockOCREngine {
    constructor() {
        this.name = 'Mock OCR Engine';
    }

    async isAvailable() {
        return true;
    }

    async extractText(imageData, options = {}) {
        // 模拟处理延迟
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 生成模拟文本内容
        const mockTexts = [
            'Learn JavaScript programming with this comprehensive tutorial.',
            'Machine Learning algorithms and data science concepts.',
            'Understanding React components and state management.',
            'Database design principles and SQL optimization.',
            'System architecture patterns for scalable applications.',
            'API development best practices and RESTful services.',
            'Cloud computing fundamentals and DevOps practices.',
            'Artificial Intelligence and neural network basics.'
        ];
        
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        const confidence = 70 + Math.random() * 25; // 70-95%的置信度
        
        return {
            text: randomText,
            confidence: confidence,
            metadata: {
                processingTime: 200,
                language: 'eng',
                engine: 'mock'
            }
        };
    }
}

module.exports = OCRService;