const { EventEmitter } = require('events');

class KeywordService extends EventEmitter {
    constructor() {
        super();
        this.domainKeywords = new Map();
        this.contextAnalyzer = new ContextAnalyzer();
        this.isEnabled = false;
        this.extractionConfig = {
            minWordLength: 3,
            maxKeywords: 10,
            confidenceThreshold: 0.5
        };
        
        console.log('[KeywordService] Service initialized');
    }

    /**
     * 初始化关键词服务
     */
    async initialize() {
        try {
            await this.loadDomainKeywords();
            this.isEnabled = true;
            console.log('[KeywordService] Service ready');
            return true;
        } catch (error) {
            console.error('[KeywordService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * 加载领域关键词
     */
    async loadDomainKeywords() {
        // 预定义的技术领域关键词
        const techKeywords = new Map([
            ['architecture', { weight: 2.0, category: 'tech' }],
            ['implementation', { weight: 1.8, category: 'tech' }],
            ['database', { weight: 1.7, category: 'tech' }],
            ['algorithm', { weight: 1.9, category: 'tech' }],
            ['framework', { weight: 1.6, category: 'tech' }],
            ['api', { weight: 1.5, category: 'tech' }],
            ['interface', { weight: 1.4, category: 'tech' }],
            ['service', { weight: 1.3, category: 'tech' }],
            ['module', { weight: 1.5, category: 'tech' }],
            ['component', { weight: 1.4, category: 'tech' }]
        ]);

        const businessKeywords = new Map([
            ['project', { weight: 1.8, category: 'business' }],
            ['meeting', { weight: 1.6, category: 'business' }],
            ['deadline', { weight: 2.0, category: 'business' }],
            ['budget', { weight: 1.9, category: 'business' }],
            ['requirement', { weight: 1.7, category: 'business' }],
            ['stakeholder', { weight: 1.8, category: 'business' }],
            ['milestone', { weight: 1.9, category: 'business' }],
            ['deliverable', { weight: 1.8, category: 'business' }]
        ]);

        // 合并所有领域关键词
        this.domainKeywords = new Map([...techKeywords, ...businessKeywords]);
        
        console.log(`[KeywordService] Loaded ${this.domainKeywords.size} domain keywords`);
    }

    /**
     * 提取关键词
     * @param {string} text - 输入文本
     * @param {object} context - 上下文信息
     * @returns {Promise<Array<object>>} 关键词列表
     */
    async extractKeywords(text, context = {}) {
        if (!this.isEnabled || !text || text.trim().length === 0) {
            return [];
        }

        try {
            // 预处理文本
            const processedText = this.preprocessText(text);
            
            // 分词和清理
            const words = this.tokenizeText(processedText);
            
            // 计算词频
            const wordFreq = this.calculateWordFrequency(words);
            
            // 计算TF-IDF分数
            const tfidfScores = this.calculateTFIDF(wordFreq, context);
            
            // 识别领域特定关键词
            const domainScores = this.identifyDomainKeywords(words);
            
            // 合并和排序关键词
            const keywords = this.combineAndRankKeywords(tfidfScores, domainScores, context);
            
            // 过滤和限制结果
            const finalKeywords = this.filterKeywords(keywords);

            // 发送关键词提取事件
            this.emit('keywords:extracted', {
                text: text,
                keywords: finalKeywords,
                context: context
            });

            return finalKeywords;

        } catch (error) {
            console.error('[KeywordService] Keyword extraction failed:', error);
            return [];
        }
    }

    /**
     * 预处理文本
     * @param {string} text - 原始文本
     * @returns {string} 处理后的文本
     */
    preprocessText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // 移除标点符号
            .replace(/\s+/g, ' ')     // 标准化空格
            .trim();
    }

    /**
     * 文本分词
     * @param {string} text - 预处理后的文本
     * @returns {Array<string>} 词汇数组
     */
    tokenizeText(text) {
        const words = text.split(' ').filter(word => 
            word.length >= this.extractionConfig.minWordLength &&
            !this.isStopWord(word)
        );
        return words;
    }

    /**
     * 检查是否为停止词
     * @param {string} word - 词汇
     * @returns {boolean} 是否为停止词
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
            'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
        ]);
        return stopWords.has(word);
    }

    /**
     * 计算词频
     * @param {Array<string>} words - 词汇数组
     * @returns {Map<string, number>} 词频映射
     */
    calculateWordFrequency(words) {
        const freq = new Map();
        words.forEach(word => {
            freq.set(word, (freq.get(word) || 0) + 1);
        });
        return freq;
    }

    /**
     * 计算TF-IDF分数
     * @param {Map<string, number>} wordFreq - 词频
     * @param {object} context - 上下文
     * @returns {Map<string, number>} TF-IDF分数
     */
    calculateTFIDF(wordFreq, context) {
        const tfidfScores = new Map();
        const totalWords = Array.from(wordFreq.values()).reduce((sum, freq) => sum + freq, 0);

        wordFreq.forEach((freq, word) => {
            // 计算TF (Term Frequency)
            const tf = freq / totalWords;
            
            // 简化的IDF计算（实际应用中应该基于更大的语料库）
            const idf = Math.log(1000 / (1 + this.getDocumentFrequency(word)));
            
            // TF-IDF分数
            const tfidf = tf * idf;
            
            tfidfScores.set(word, tfidf);
        });

        return tfidfScores;
    }

    /**
     * 获取文档频率（简化版本）
     * @param {string} word - 词汇
     * @returns {number} 文档频率
     */
    getDocumentFrequency(word) {
        // 简化的文档频率估算
        // 实际应用中应该基于真实的文档集合
        const commonWords = new Set(['project', 'meeting', 'team', 'work', 'time', 'system']);
        return commonWords.has(word) ? 100 : 10;
    }

    /**
     * 识别领域特定关键词
     * @param {Array<string>} words - 词汇数组
     * @returns {Map<string, number>} 领域关键词分数
     */
    identifyDomainKeywords(words) {
        const domainScores = new Map();
        
        words.forEach(word => {
            if (this.domainKeywords.has(word)) {
                const keywordInfo = this.domainKeywords.get(word);
                domainScores.set(word, keywordInfo.weight);
            }
        });

        return domainScores;
    }

    /**
     * 合并和排序关键词
     * @param {Map<string, number>} tfidfScores - TF-IDF分数
     * @param {Map<string, number>} domainScores - 领域分数
     * @param {object} context - 上下文
     * @returns {Array<object>} 排序后的关键词
     */
    combineAndRankKeywords(tfidfScores, domainScores, context) {
        const combinedScores = new Map();

        // 合并TF-IDF分数
        tfidfScores.forEach((score, word) => {
            combinedScores.set(word, {
                word: word,
                tfidfScore: score,
                domainScore: domainScores.get(word) || 0,
                finalScore: score
            });
        });

        // 增强领域关键词分数
        domainScores.forEach((score, word) => {
            if (combinedScores.has(word)) {
                const existing = combinedScores.get(word);
                existing.finalScore = existing.tfidfScore + (score * 0.5);
            } else {
                combinedScores.set(word, {
                    word: word,
                    tfidfScore: 0,
                    domainScore: score,
                    finalScore: score * 0.3
                });
            }
        });

        // 转换为数组并排序
        const keywords = Array.from(combinedScores.values())
            .sort((a, b) => b.finalScore - a.finalScore);

        return keywords;
    }

    /**
     * 过滤关键词
     * @param {Array<object>} keywords - 关键词列表
     * @returns {Array<object>} 过滤后的关键词
     */
    filterKeywords(keywords) {
        return keywords
            .filter(keyword => keyword.finalScore >= this.extractionConfig.confidenceThreshold)
            .slice(0, this.extractionConfig.maxKeywords)
            .map(keyword => ({
                word: keyword.word,
                score: Math.round(keyword.finalScore * 100) / 100,
                category: this.getKeywordCategory(keyword.word),
                importance: this.getImportanceLevel(keyword.finalScore)
            }));
    }

    /**
     * 获取关键词类别
     * @param {string} word - 词汇
     * @returns {string} 类别
     */
    getKeywordCategory(word) {
        if (this.domainKeywords.has(word)) {
            return this.domainKeywords.get(word).category;
        }
        return 'general';
    }

    /**
     * 获取重要性级别
     * @param {number} score - 分数
     * @returns {string} 重要性级别
     */
    getImportanceLevel(score) {
        if (score >= 1.5) return 'high';
        if (score >= 1.0) return 'medium';
        return 'low';
    }

    /**
     * 更新领域模型
     * @param {Array<string>} newKeywords - 新关键词
     */
    updateDomainModel(newKeywords) {
        newKeywords.forEach(keyword => {
            if (!this.domainKeywords.has(keyword)) {
                this.domainKeywords.set(keyword, {
                    weight: 1.0,
                    category: 'learned'
                });
            }
        });
        
        console.log(`[KeywordService] Domain model updated with ${newKeywords.length} new keywords`);
        this.emit('domain:updated', { newKeywords });
    }

    /**
     * 设置提取配置
     * @param {object} config - 配置对象
     */
    setConfig(config) {
        this.extractionConfig = { ...this.extractionConfig, ...config };
        console.log('[KeywordService] Configuration updated:', this.extractionConfig);
    }

    /**
     * 启用/禁用服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[KeywordService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 获取服务状态
     * @returns {object} 服务状态
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            domainKeywordsCount: this.domainKeywords.size,
            config: this.extractionConfig
        };
    }
}

/**
 * 上下文分析器（简化版本）
 */
class ContextAnalyzer {
    constructor() {
        this.conversationHistory = [];
    }

    /**
     * 分析上下文
     * @param {string} text - 文本
     * @param {object} context - 上下文
     * @returns {object} 分析结果
     */
    analyze(text, context) {
        return {
            topic: this.identifyTopic(text),
            sentiment: this.analyzeSentiment(text),
            entities: this.extractEntities(text)
        };
    }

    /**
     * 识别主题
     * @param {string} text - 文本
     * @returns {string} 主题
     */
    identifyTopic(text) {
        // 简化的主题识别
        if (text.includes('meeting') || text.includes('discussion')) return 'meeting';
        if (text.includes('project') || text.includes('development')) return 'project';
        if (text.includes('technical') || text.includes('architecture')) return 'technical';
        return 'general';
    }

    /**
     * 情感分析
     * @param {string} text - 文本
     * @returns {string} 情感
     */
    analyzeSentiment(text) {
        // 简化的情感分析
        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing'];
        const negativeWords = ['bad', 'terrible', 'awful', 'problem', 'issue'];
        
        const positive = positiveWords.some(word => text.includes(word));
        const negative = negativeWords.some(word => text.includes(word));
        
        if (positive && !negative) return 'positive';
        if (negative && !positive) return 'negative';
        return 'neutral';
    }

    /**
     * 实体提取
     * @param {string} text - 文本
     * @returns {Array<string>} 实体列表
     */
    extractEntities(text) {
        // 简化的实体提取
        const entities = [];
        
        // 简单的日期识别
        const dateRegex = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;
        const dates = text.match(dateRegex) || [];
        entities.push(...dates.map(date => ({ type: 'date', value: date })));
        
        // 简单的时间识别
        const timeRegex = /\d{1,2}:\d{2}(?:\s*(?:AM|PM))?/gi;
        const times = text.match(timeRegex) || [];
        entities.push(...times.map(time => ({ type: 'time', value: time })));
        
        return entities;
    }
}

module.exports = KeywordService;