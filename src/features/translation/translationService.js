const { EventEmitter } = require('events');

class TranslationService extends EventEmitter {
    constructor() {
        super();
        this.providers = ['google', 'deepl', 'azure'];
        this.cache = new Map();
        this.currentLanguagePair = 'en-zh';
        this.defaultProvider = 'google';
        this.isEnabled = false;
        
        console.log('[TranslationService] Service initialized');
    }

    /**
     * 初始化翻译服务
     */
    async initialize() {
        try {
            // 从设置中加载配置
            await this.loadConfiguration();
            this.isEnabled = true;
            console.log('[TranslationService] Service ready');
            return true;
        } catch (error) {
            console.error('[TranslationService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * 加载翻译配置
     */
    async loadConfiguration() {
        // TODO: 从设置服务加载配置
        this.currentLanguagePair = 'en-zh'; // 默认英中翻译
        this.defaultProvider = 'google';
    }

    /**
     * 实时翻译文本
     * @param {string} text - 待翻译文本
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {Promise<object>} 翻译结果
     */
    async translateText(text, sourceLang = null, targetLang = null) {
        if (!this.isEnabled || !text || text.trim().length === 0) {
            return null;
        }

        try {
            // 使用当前语言对或指定语言
            const [source, target] = this.parseLanguagePair(sourceLang, targetLang);
            
            // 检查缓存
            const cacheKey = `${text}_${source}_${target}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // 检测语言（如果需要）
            const detectedLang = await this.detectLanguage(text);
            const finalSource = source || detectedLang;

            // 如果源语言和目标语言相同，跳过翻译
            if (finalSource === target) {
                return {
                    originalText: text,
                    translatedText: text,
                    sourceLang: finalSource,
                    targetLang: target,
                    confidence: 1.0,
                    provider: 'none'
                };
            }

            // 执行翻译
            const result = await this.performTranslation(text, finalSource, target);
            
            // 缓存结果
            this.cache.set(cacheKey, result);
            
            // 清理缓存（保持在合理大小）
            if (this.cache.size > 1000) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            // 发送翻译事件
            this.emit('translation:complete', result);
            
            return result;

        } catch (error) {
            console.error('[TranslationService] Translation failed:', error);
            return {
                originalText: text,
                translatedText: text,
                sourceLang: sourceLang || 'unknown',
                targetLang: targetLang || 'unknown',
                confidence: 0,
                provider: 'error',
                error: error.message
            };
        }
    }

    /**
     * 语言检测
     * @param {string} text - 待检测文本
     * @returns {Promise<string>} 检测到的语言代码
     */
    async detectLanguage(text) {
        try {
            // 简单的语言检测逻辑
            // 检测中文字符
            const chineseRegex = /[\u4e00-\u9fff]/;
            if (chineseRegex.test(text)) {
                return 'zh';
            }
            
            // 检测日文
            const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
            if (japaneseRegex.test(text)) {
                return 'ja';
            }
            
            // 检测韩文
            const koreanRegex = /[\uac00-\ud7af]/;
            if (koreanRegex.test(text)) {
                return 'ko';
            }
            
            // 默认认为是英文
            return 'en';
            
        } catch (error) {
            console.error('[TranslationService] Language detection failed:', error);
            return 'en'; // 默认返回英文
        }
    }

    /**
     * 执行翻译（模拟实现）
     * @param {string} text - 文本
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {Promise<object>} 翻译结果
     */
    async performTranslation(text, sourceLang, targetLang) {
        // 模拟翻译延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        // 这里应该调用实际的翻译API
        // 目前返回模拟结果
        return {
            originalText: text,
            translatedText: this.getMockTranslation(text, sourceLang, targetLang),
            sourceLang: sourceLang,
            targetLang: targetLang,
            confidence: 0.95,
            provider: this.defaultProvider,
            timestamp: Date.now()
        };
    }

    /**
     * 获取模拟翻译（用于测试）
     * @param {string} text - 原文
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {string} 模拟翻译结果
     */
    getMockTranslation(text, sourceLang, targetLang) {
        if (sourceLang === 'en' && targetLang === 'zh') {
            // 简单的英中翻译映射
            const translations = {
                'hello': '你好',
                'world': '世界',
                'meeting': '会议',
                'project': '项目',
                'development': '开发',
                'implementation': '实现',
                'architecture': '架构',
                'design': '设计'
            };
            
            // 尝试翻译常见词汇
            let result = text.toLowerCase();
            for (const [en, zh] of Object.entries(translations)) {
                result = result.replace(new RegExp(en, 'gi'), zh);
            }
            
            return result !== text.toLowerCase() ? result : `[翻译] ${text}`;
        }
        
        if (sourceLang === 'zh' && targetLang === 'en') {
            return `[Translation] ${text}`;
        }
        
        return `[${targetLang.toUpperCase()}] ${text}`;
    }

    /**
     * 解析语言对
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {Array<string>} [源语言, 目标语言]
     */
    parseLanguagePair(sourceLang, targetLang) {
        if (sourceLang && targetLang) {
            return [sourceLang, targetLang];
        }
        
        const [source, target] = this.currentLanguagePair.split('-');
        return [sourceLang || source, targetLang || target];
    }

    /**
     * 设置语言对
     * @param {string} source - 源语言
     * @param {string} target - 目标语言
     */
    setLanguagePair(source, target) {
        this.currentLanguagePair = `${source}-${target}`;
        console.log(`[TranslationService] Language pair updated: ${this.currentLanguagePair}`);
        this.emit('languagePair:changed', { source, target });
    }

    /**
     * 批量翻译
     * @param {Array<string>} texts - 文本数组
     * @param {string} sourceLang - 源语言
     * @param {string} targetLang - 目标语言
     * @returns {Promise<Array<object>>} 翻译结果数组
     */
    async batchTranslate(texts, sourceLang, targetLang) {
        const results = [];
        
        for (const text of texts) {
            try {
                const result = await this.translateText(text, sourceLang, targetLang);
                results.push(result);
            } catch (error) {
                results.push({
                    originalText: text,
                    translatedText: text,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
        console.log('[TranslationService] Cache cleared');
    }

    /**
     * 获取缓存状态
     * @returns {object} 缓存信息
     */
    getCacheInfo() {
        return {
            size: this.cache.size,
            maxSize: 1000
        };
    }

    /**
     * 启用/禁用翻译服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[TranslationService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 获取服务状态
     * @returns {object} 服务状态
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            currentLanguagePair: this.currentLanguagePair,
            defaultProvider: this.defaultProvider,
            cacheSize: this.cache.size
        };
    }
}

module.exports = TranslationService;