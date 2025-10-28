const { EventEmitter } = require('events');

class GlossaryService extends EventEmitter {
    constructor() {
        super();
        this.definitionCache = new Map();
        this.contextualDefinitions = new Map();
        this.aiDefinitionGenerator = new AIDefinitionGenerator();
        this.isEnabled = false;
        this.defaultDefinitions = new Map();
        this.maxCacheSize = 500;
        
        console.log('[GlossaryService] Service initialized');
    }

    /**
     * 初始化术语解释服务
     */
    async initialize() {
        try {
            await this.loadDefaultDefinitions();
            this.isEnabled = true;
            console.log('[GlossaryService] Service ready');
            return true;
        } catch (error) {
            console.error('[GlossaryService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * 加载默认术语定义
     */
    async loadDefaultDefinitions() {
        // 技术术语定义
        const techDefinitions = new Map([
            ['api', {
                definition: 'Application Programming Interface - 应用程序编程接口，允许不同软件系统之间进行通信的接口规范',
                category: 'technology',
                examples: ['REST API', 'GraphQL API'],
                relatedTerms: ['endpoint', 'interface', 'service']
            }],
            ['architecture', {
                definition: '系统架构 - 软件系统的高层结构设计，包括组件、模块及其相互关系',
                category: 'technology',
                examples: ['微服务架构', '单体架构', '事件驱动架构'],
                relatedTerms: ['design pattern', 'scalability', 'modularity']
            }],
            ['database', {
                definition: '数据库 - 组织、存储和管理数据的系统',
                category: 'technology',
                examples: ['MySQL', 'PostgreSQL', 'MongoDB'],
                relatedTerms: ['sql', 'nosql', 'orm']
            }],
            ['framework', {
                definition: '框架 - 提供基础功能和结构的软件平台，用于快速开发应用程序',
                category: 'technology',
                examples: ['React', 'Vue.js', 'Express.js'],
                relatedTerms: ['library', 'toolkit', 'platform']
            }],
            ['algorithm', {
                definition: '算法 - 解决特定问题的步骤化程序或公式',
                category: 'technology',
                examples: ['排序算法', '搜索算法', '机器学习算法'],
                relatedTerms: ['complexity', 'optimization', 'data structure']
            }]
        ]);

        // 业务术语定义
        const businessDefinitions = new Map([
            ['stakeholder', {
                definition: '利益相关者 - 对项目或组织有利益关系或影响的个人或团体',
                category: 'business',
                examples: ['客户', '投资者', '员工', '供应商'],
                relatedTerms: ['customer', 'investor', 'partner']
            }],
            ['milestone', {
                definition: '里程碑 - 项目中的重要节点或成就，标志着关键阶段的完成',
                category: 'business',
                examples: ['产品发布', '原型完成', '测试通过'],
                relatedTerms: ['deadline', 'deliverable', 'timeline']
            }],
            ['deliverable', {
                definition: '交付物 - 项目中需要交付给客户或利益相关者的具体成果或产品',
                category: 'business',
                examples: ['软件产品', '设计文档', '测试报告'],
                relatedTerms: ['output', 'result', 'product']
            }],
            ['requirement', {
                definition: '需求 - 系统或项目必须满足的功能、性能或约束条件',
                category: 'business',
                examples: ['功能需求', '性能需求', '安全需求'],
                relatedTerms: ['specification', 'criteria', 'constraint']
            }]
        ]);

        // 合并所有默认定义
        this.defaultDefinitions = new Map([...techDefinitions, ...businessDefinitions]);
        
        console.log(`[GlossaryService] Loaded ${this.defaultDefinitions.size} default definitions`);
    }

    /**
     * 获取术语定义
     * @param {string} term - 术语
     * @param {object} context - 上下文信息
     * @returns {Promise<object|null>} 术语定义
     */
    async getDefinition(term, context = {}) {
        if (!this.isEnabled || !term) {
            return null;
        }

        try {
            const normalizedTerm = this.normalizeTerm(term);
            
            // 1. 检查缓存
            const cacheKey = `${normalizedTerm}_${JSON.stringify(context)}`;
            if (this.definitionCache.has(cacheKey)) {
                const cached = this.definitionCache.get(cacheKey);
                this.emit('definition:retrieved', { term, source: 'cache', definition: cached });
                return cached;
            }

            // 2. 检查默认定义
            if (this.defaultDefinitions.has(normalizedTerm)) {
                const defaultDef = this.defaultDefinitions.get(normalizedTerm);
                const definition = {
                    term: normalizedTerm,
                    definition: defaultDef.definition,
                    category: defaultDef.category,
                    examples: defaultDef.examples || [],
                    relatedTerms: defaultDef.relatedTerms || [],
                    source: 'default',
                    confidence: 1.0,
                    timestamp: Date.now()
                };

                // 缓存定义
                this.cacheDefinition(cacheKey, definition);
                this.emit('definition:retrieved', { term, source: 'default', definition });
                return definition;
            }

            // 3. 生成上下文相关定义
            const contextualDefinition = await this.generateContextualDefinition(normalizedTerm, context);
            if (contextualDefinition) {
                this.cacheDefinition(cacheKey, contextualDefinition);
                this.emit('definition:generated', { term, definition: contextualDefinition });
                return contextualDefinition;
            }

            // 4. 如果都没有找到，返回基础信息
            const basicDefinition = {
                term: normalizedTerm,
                definition: `${normalizedTerm} - 术语定义正在生成中...`,
                category: 'unknown',
                examples: [],
                relatedTerms: [],
                source: 'placeholder',
                confidence: 0.1,
                timestamp: Date.now()
            };

            return basicDefinition;

        } catch (error) {
            console.error('[GlossaryService] Failed to get definition:', error);
            return null;
        }
    }

    /**
     * 生成上下文相关定义
     * @param {string} term - 术语
     * @param {object} context - 上下文
     * @returns {Promise<object|null>} 定义对象
     */
    async generateContextualDefinition(term, context) {
        try {
            // 分析上下文
            const contextAnalysis = this.analyzeContext(context);
            
            // 使用AI生成器生成定义
            const aiDefinition = await this.aiDefinitionGenerator.generateDefinition(term, contextAnalysis);
            
            if (aiDefinition) {
                return {
                    term: term,
                    definition: aiDefinition.definition,
                    category: aiDefinition.category || this.inferCategory(term, context),
                    examples: aiDefinition.examples || [],
                    relatedTerms: aiDefinition.relatedTerms || [],
                    source: 'ai_generated',
                    confidence: aiDefinition.confidence || 0.8,
                    context: contextAnalysis,
                    timestamp: Date.now()
                };
            }

            return null;

        } catch (error) {
            console.error('[GlossaryService] Failed to generate contextual definition:', error);
            return null;
        }
    }

    /**
     * 分析上下文
     * @param {object} context - 上下文信息
     * @returns {object} 上下文分析结果
     */
    analyzeContext(context) {
        return {
            domain: this.identifyDomain(context),
            topic: context.topic || 'general',
            conversationHistory: context.conversationHistory || [],
            relatedTerms: context.relatedTerms || [],
            userLevel: context.userLevel || 'intermediate'
        };
    }

    /**
     * 识别领域
     * @param {object} context - 上下文
     * @returns {string} 领域
     */
    identifyDomain(context) {
        if (!context.text) return 'general';
        
        const text = context.text.toLowerCase();
        
        if (text.includes('software') || text.includes('code') || text.includes('programming')) {
            return 'technology';
        }
        
        if (text.includes('business') || text.includes('management') || text.includes('project')) {
            return 'business';
        }
        
        if (text.includes('research') || text.includes('academic') || text.includes('study')) {
            return 'academic';
        }
        
        return 'general';
    }

    /**
     * 推断术语类别
     * @param {string} term - 术语
     * @param {object} context - 上下文
     * @returns {string} 类别
     */
    inferCategory(term, context) {
        const domain = this.identifyDomain(context);
        
        // 基于常见术语模式推断
        const techPatterns = ['service', 'api', 'framework', 'library', 'database'];
        const businessPatterns = ['project', 'meeting', 'stakeholder', 'deliverable'];
        
        if (techPatterns.some(pattern => term.includes(pattern))) {
            return 'technology';
        }
        
        if (businessPatterns.some(pattern => term.includes(pattern))) {
            return 'business';
        }
        
        return domain;
    }

    /**
     * 标准化术语
     * @param {string} term - 原始术语
     * @returns {string} 标准化术语
     */
    normalizeTerm(term) {
        return term.toLowerCase().trim().replace(/[^\w\s]/g, '');
    }

    /**
     * 缓存定义
     * @param {string} key - 缓存键
     * @param {object} definition - 定义对象
     */
    cacheDefinition(key, definition) {
        // 如果缓存已满，删除最旧的条目
        if (this.definitionCache.size >= this.maxCacheSize) {
            const firstKey = this.definitionCache.keys().next().value;
            this.definitionCache.delete(firstKey);
        }
        
        this.definitionCache.set(key, definition);
    }

    /**
     * 批量获取定义
     * @param {Array<string>} terms - 术语数组
     * @param {object} context - 上下文
     * @returns {Promise<Map<string, object>>} 定义映射
     */
    async batchGetDefinitions(terms, context = {}) {
        const definitions = new Map();
        
        // 并行处理术语定义
        const promises = terms.map(async (term) => {
            try {
                const definition = await this.getDefinition(term, context);
                if (definition) {
                    definitions.set(term, definition);
                }
            } catch (error) {
                console.error(`[GlossaryService] Failed to get definition for ${term}:`, error);
            }
        });

        await Promise.all(promises);
        return definitions;
    }

    /**
     * 添加自定义定义
     * @param {string} term - 术语
     * @param {object} definitionData - 定义数据
     */
    addCustomDefinition(term, definitionData) {
        const normalizedTerm = this.normalizeTerm(term);
        
        const customDefinition = {
            definition: definitionData.definition,
            category: definitionData.category || 'custom',
            examples: definitionData.examples || [],
            relatedTerms: definitionData.relatedTerms || [],
            source: 'user_defined',
            confidence: 1.0,
            timestamp: Date.now()
        };

        this.defaultDefinitions.set(normalizedTerm, customDefinition);
        
        console.log(`[GlossaryService] Added custom definition for: ${normalizedTerm}`);
        this.emit('definition:added', { term: normalizedTerm, definition: customDefinition });
    }

    /**
     * 更新定义
     * @param {string} term - 术语
     * @param {object} updateData - 更新数据
     */
    updateDefinition(term, updateData) {
        const normalizedTerm = this.normalizeTerm(term);
        
        if (this.defaultDefinitions.has(normalizedTerm)) {
            const existing = this.defaultDefinitions.get(normalizedTerm);
            const updated = { ...existing, ...updateData, timestamp: Date.now() };
            this.defaultDefinitions.set(normalizedTerm, updated);
            
            // 清除相关缓存
            this.clearTermCache(normalizedTerm);
            
            console.log(`[GlossaryService] Updated definition for: ${normalizedTerm}`);
            this.emit('definition:updated', { term: normalizedTerm, definition: updated });
        }
    }

    /**
     * 清除术语缓存
     * @param {string} term - 术语
     */
    clearTermCache(term) {
        const keysToDelete = [];
        for (const key of this.definitionCache.keys()) {
            if (key.startsWith(`${term}_`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.definitionCache.delete(key));
    }

    /**
     * 清理所有缓存
     */
    clearAllCache() {
        this.definitionCache.clear();
        console.log('[GlossaryService] All cache cleared');
        this.emit('cache:cleared');
    }

    /**
     * 获取术语统计
     * @returns {object} 统计信息
     */
    getStatistics() {
        return {
            defaultDefinitions: this.defaultDefinitions.size,
            cachedDefinitions: this.definitionCache.size,
            maxCacheSize: this.maxCacheSize,
            isEnabled: this.isEnabled
        };
    }

    /**
     * 启用/禁用服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[GlossaryService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 导出定义数据
     * @returns {object} 定义数据
     */
    exportDefinitions() {
        const exported = {
            defaultDefinitions: Object.fromEntries(this.defaultDefinitions),
            timestamp: Date.now()
        };
        
        return exported;
    }

    /**
     * 导入定义数据
     * @param {object} data - 定义数据
     */
    importDefinitions(data) {
        if (data.defaultDefinitions) {
            const imported = new Map(Object.entries(data.defaultDefinitions));
            
            // 合并到现有定义中
            for (const [term, definition] of imported) {
                this.defaultDefinitions.set(term, definition);
            }
            
            console.log(`[GlossaryService] Imported ${imported.size} definitions`);
            this.emit('definitions:imported', { count: imported.size });
        }
    }
}

/**
 * AI定义生成器（模拟实现）
 */
class AIDefinitionGenerator {
    constructor() {
        this.isEnabled = false;
    }

    /**
     * 生成定义
     * @param {string} term - 术语
     * @param {object} context - 上下文
     * @returns {Promise<object|null>} 生成的定义
     */
    async generateDefinition(term, context) {
        // 模拟AI生成延迟
        await new Promise(resolve => setTimeout(resolve, 200));

        // 这里应该调用实际的AI服务
        // 目前返回模拟结果
        return {
            definition: `${term} - 基于上下文智能生成的定义`,
            category: context.domain || 'general',
            examples: [`${term}的应用示例`],
            relatedTerms: this.generateRelatedTerms(term),
            confidence: 0.8
        };
    }

    /**
     * 生成相关术语
     * @param {string} term - 术语
     * @returns {Array<string>} 相关术语
     */
    generateRelatedTerms(term) {
        // 简化的相关术语生成
        const commonRelated = {
            'api': ['endpoint', 'interface', 'service'],
            'database': ['table', 'query', 'schema'],
            'framework': ['library', 'component', 'module'],
            'project': ['task', 'milestone', 'deliverable']
        };

        return commonRelated[term] || [];
    }
}

module.exports = GlossaryService;