const { EventEmitter } = require('events');

class MindMapService extends EventEmitter {
    constructor() {
        super();
        this.structureAnalyzer = new ConversationStructureAnalyzer();
        this.graphBuilder = new GraphBuilder();
        this.layoutEngine = new LayoutEngine();
        this.currentMindMap = null;
        this.isEnabled = false;
        this.config = {
            maxNodes: 50,
            updateInterval: 5000, // 5秒更新间隔
            autoLayout: true,
            showConnections: true
        };
        
        console.log('[MindMapService] Service initialized');
    }

    /**
     * 初始化思维导图服务
     */
    async initialize() {
        try {
            this.currentMindMap = this.createEmptyMindMap();
            this.isEnabled = true;
            console.log('[MindMapService] Service ready');
            return true;
        } catch (error) {
            console.error('[MindMapService] Initialization failed:', error);
            return false;
        }
    }

    /**
     * 创建空的思维导图
     * @returns {object} 空思维导图对象
     */
    createEmptyMindMap() {
        return {
            id: this.generateId(),
            rootNode: null,
            nodes: new Map(),
            connections: new Map(),
            metadata: {
                created: Date.now(),
                updated: Date.now(),
                nodeCount: 0,
                connectionCount: 0
            },
            layout: {
                type: 'radial',
                center: { x: 0, y: 0 },
                bounds: { width: 800, height: 600 }
            }
        };
    }

    /**
     * 分析对话结构
     * @param {string} transcript - 对话文本
     * @param {object} context - 上下文信息
     * @returns {Promise<object>} 结构分析结果
     */
    async analyzeConversationStructure(transcript, context = {}) {
        if (!this.isEnabled || !transcript) {
            return null;
        }

        try {
            // 1. 主题识别
            const topics = await this.structureAnalyzer.identifyTopics(transcript);
            
            // 2. 逻辑关系分析
            const relationships = await this.structureAnalyzer.analyzeRelationships(transcript, topics);
            
            // 3. 层次结构构建
            const hierarchy = await this.structureAnalyzer.buildHierarchy(topics, relationships);
            
            // 4. 时间序列分析
            const timeline = await this.structureAnalyzer.analyzeTimeline(transcript, context);

            const analysis = {
                topics: topics,
                relationships: relationships,
                hierarchy: hierarchy,
                timeline: timeline,
                metadata: {
                    textLength: transcript.length,
                    topicCount: topics.length,
                    relationshipCount: relationships.length,
                    analysisTime: Date.now()
                }
            };

            this.emit('structure:analyzed', analysis);
            return analysis;

        } catch (error) {
            console.error('[MindMapService] Structure analysis failed:', error);
            return null;
        }
    }

    /**
     * 更新思维导图
     * @param {string} newContent - 新内容
     * @param {object} existingMap - 现有思维导图
     * @returns {Promise<object>} 更新后的思维导图
     */
    async updateMindMap(newContent, existingMap = null) {
        if (!this.isEnabled || !newContent) {
            return this.currentMindMap;
        }

        try {
            const targetMap = existingMap || this.currentMindMap;
            
            // 1. 分析新内容结构
            const newStructure = await this.analyzeConversationStructure(newContent);
            if (!newStructure) {
                return targetMap;
            }

            // 2. 更新节点
            const updatedNodes = await this.updateNodes(targetMap, newStructure);
            
            // 3. 更新连接
            const updatedConnections = await this.updateConnections(targetMap, newStructure);
            
            // 4. 重新计算布局
            const newLayout = await this.layoutEngine.calculateLayout(updatedNodes, updatedConnections);

            // 5. 构建更新后的思维导图
            const updatedMindMap = {
                ...targetMap,
                nodes: updatedNodes,
                connections: updatedConnections,
                layout: newLayout,
                metadata: {
                    ...targetMap.metadata,
                    updated: Date.now(),
                    nodeCount: updatedNodes.size,
                    connectionCount: updatedConnections.size
                }
            };

            this.currentMindMap = updatedMindMap;
            this.emit('mindmap:updated', updatedMindMap);
            
            return updatedMindMap;

        } catch (error) {
            console.error('[MindMapService] MindMap update failed:', error);
            return existingMap || this.currentMindMap;
        }
    }

    /**
     * 更新节点
     * @param {object} mindMap - 思维导图
     * @param {object} structure - 结构分析结果
     * @returns {Promise<Map>} 更新后的节点集合
     */
    async updateNodes(mindMap, structure) {
        const nodes = new Map(mindMap.nodes);
        
        // 处理主题作为节点
        structure.topics.forEach((topic, index) => {
            const nodeId = this.generateNodeId(topic.text);
            
            if (nodes.has(nodeId)) {
                // 更新现有节点
                const existingNode = nodes.get(nodeId);
                existingNode.weight += topic.importance;
                existingNode.lastUpdated = Date.now();
                existingNode.mentions += 1;
            } else {
                // 创建新节点
                const newNode = {
                    id: nodeId,
                    text: topic.text,
                    type: this.determineNodeType(topic),
                    weight: topic.importance,
                    level: topic.level || 1,
                    category: topic.category || 'general',
                    position: { x: 0, y: 0 }, // 将由布局引擎计算
                    size: this.calculateNodeSize(topic.importance),
                    color: this.getNodeColor(topic.category),
                    created: Date.now(),
                    lastUpdated: Date.now(),
                    mentions: 1,
                    connections: []
                };
                
                nodes.set(nodeId, newNode);
                
                // 设置根节点
                if (index === 0 && !mindMap.rootNode) {
                    mindMap.rootNode = nodeId;
                    newNode.isRoot = true;
                }
            }
        });

        return nodes;
    }

    /**
     * 更新连接
     * @param {object} mindMap - 思维导图
     * @param {object} structure - 结构分析结果
     * @returns {Promise<Map>} 更新后的连接集合
     */
    async updateConnections(mindMap, structure) {
        const connections = new Map(mindMap.connections);
        
        // 处理关系作为连接
        structure.relationships.forEach(relationship => {
            const sourceId = this.generateNodeId(relationship.source);
            const targetId = this.generateNodeId(relationship.target);
            const connectionId = `${sourceId}-${targetId}`;
            
            if (connections.has(connectionId)) {
                // 更新现有连接
                const existingConnection = connections.get(connectionId);
                existingConnection.strength += relationship.strength;
                existingConnection.lastUpdated = Date.now();
            } else {
                // 创建新连接
                const newConnection = {
                    id: connectionId,
                    source: sourceId,
                    target: targetId,
                    type: relationship.type || 'related',
                    strength: relationship.strength,
                    label: relationship.label || '',
                    direction: relationship.direction || 'bidirectional',
                    created: Date.now(),
                    lastUpdated: Date.now(),
                    style: this.getConnectionStyle(relationship.type)
                };
                
                connections.set(connectionId, newConnection);
            }
        });

        return connections;
    }

    /**
     * 生成可视化数据
     * @param {object} mindMap - 思维导图
     * @returns {object} 可视化数据
     */
    generateVisualization(mindMap = null) {
        const targetMap = mindMap || this.currentMindMap;
        
        if (!targetMap) {
            return null;
        }

        // 转换为可视化库所需的格式
        const visualization = {
            nodes: Array.from(targetMap.nodes.values()).map(node => ({
                id: node.id,
                label: node.text,
                x: node.position.x,
                y: node.position.y,
                size: node.size,
                color: node.color,
                type: node.type,
                weight: node.weight,
                category: node.category,
                isRoot: node.isRoot || false
            })),
            edges: Array.from(targetMap.connections.values()).map(connection => ({
                id: connection.id,
                source: connection.source,
                target: connection.target,
                type: connection.type,
                strength: connection.strength,
                label: connection.label,
                style: connection.style
            })),
            layout: targetMap.layout,
            metadata: targetMap.metadata
        };

        return visualization;
    }

    /**
     * 确定节点类型
     * @param {object} topic - 主题对象
     * @returns {string} 节点类型
     */
    determineNodeType(topic) {
        if (topic.importance > 0.8) return 'primary';
        if (topic.importance > 0.5) return 'secondary';
        return 'tertiary';
    }

    /**
     * 计算节点大小
     * @param {number} importance - 重要性
     * @returns {number} 节点大小
     */
    calculateNodeSize(importance) {
        const minSize = 10;
        const maxSize = 50;
        return minSize + (importance * (maxSize - minSize));
    }

    /**
     * 获取节点颜色
     * @param {string} category - 类别
     * @returns {string} 颜色值
     */
    getNodeColor(category) {
        const colorMap = {
            'technology': '#4A90E2',
            'business': '#F5A623',
            'person': '#7ED321',
            'action': '#D0021B',
            'concept': '#9013FE',
            'general': '#50E3C2'
        };
        
        return colorMap[category] || colorMap['general'];
    }

    /**
     * 获取连接样式
     * @param {string} type - 连接类型
     * @returns {object} 样式对象
     */
    getConnectionStyle(type) {
        const styleMap = {
            'cause': { stroke: '#D0021B', strokeWidth: 2, lineDash: [] },
            'sequence': { stroke: '#F5A623', strokeWidth: 2, lineDash: [5, 5] },
            'related': { stroke: '#4A90E2', strokeWidth: 1, lineDash: [] },
            'depends': { stroke: '#7ED321', strokeWidth: 2, lineDash: [10, 5] }
        };
        
        return styleMap[type] || styleMap['related'];
    }

    /**
     * 生成节点ID
     * @param {string} text - 节点文本
     * @returns {string} 节点ID
     */
    generateNodeId(text) {
        return `node_${text.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return `mindmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 导出思维导图
     * @param {string} format - 导出格式 ('json' | 'svg' | 'png')
     * @returns {object|string} 导出数据
     */
    exportMindMap(format = 'json') {
        if (!this.currentMindMap) {
            return null;
        }

        switch (format) {
            case 'json':
                return JSON.stringify(this.currentMindMap, null, 2);
            case 'visualization':
                return this.generateVisualization();
            default:
                return this.currentMindMap;
        }
    }

    /**
     * 清除思维导图
     */
    clearMindMap() {
        this.currentMindMap = this.createEmptyMindMap();
        console.log('[MindMapService] MindMap cleared');
        this.emit('mindmap:cleared');
    }

    /**
     * 设置配置
     * @param {object} newConfig - 新配置
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[MindMapService] Configuration updated:', this.config);
        this.emit('config:updated', this.config);
    }

    /**
     * 启用/禁用服务
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[MindMapService] Service ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('service:toggle', { enabled });
    }

    /**
     * 获取服务状态
     * @returns {object} 服务状态
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            hasCurrentMap: !!this.currentMindMap,
            nodeCount: this.currentMindMap ? this.currentMindMap.nodes.size : 0,
            connectionCount: this.currentMindMap ? this.currentMindMap.connections.size : 0,
            config: this.config
        };
    }
}

/**
 * 对话结构分析器
 */
class ConversationStructureAnalyzer {
    constructor() {
        this.topicPatterns = new Map([
            ['question', /\b(what|how|why|when|where|who)\b/gi],
            ['action', /\b(need to|should|must|will|going to)\b/gi],
            ['problem', /\b(issue|problem|error|bug|trouble)\b/gi],
            ['solution', /\b(solve|fix|resolve|answer|solution)\b/gi]
        ]);
    }

    /**
     * 识别主题
     * @param {string} text - 文本
     * @returns {Array<object>} 主题列表
     */
    async identifyTopics(text) {
        const topics = [];
        const sentences = this.splitIntoSentences(text);
        
        sentences.forEach((sentence, index) => {
            const words = this.extractKeywords(sentence);
            
            if (words.length > 0) {
                const topic = {
                    text: this.extractTopicText(sentence, words),
                    importance: this.calculateImportance(sentence, words),
                    level: this.determineLevel(index, sentences.length),
                    category: this.categorizeText(sentence),
                    position: index,
                    keywords: words
                };
                
                topics.push(topic);
            }
        });

        return topics;
    }

    /**
     * 分析关系
     * @param {string} text - 文本
     * @param {Array<object>} topics - 主题列表
     * @returns {Array<object>} 关系列表
     */
    async analyzeRelationships(text, topics) {
        const relationships = [];
        
        for (let i = 0; i < topics.length; i++) {
            for (let j = i + 1; j < topics.length; j++) {
                const source = topics[i];
                const target = topics[j];
                
                const relationship = this.findRelationship(source, target, text);
                if (relationship) {
                    relationships.push(relationship);
                }
            }
        }

        return relationships;
    }

    /**
     * 构建层次结构
     * @param {Array<object>} topics - 主题列表
     * @param {Array<object>} relationships - 关系列表
     * @returns {object} 层次结构
     */
    async buildHierarchy(topics, relationships) {
        const hierarchy = {
            root: null,
            levels: new Map(),
            connections: relationships
        };

        // 找到根主题（最重要的主题）
        const rootTopic = topics.reduce((prev, current) => 
            (prev.importance > current.importance) ? prev : current
        );

        hierarchy.root = rootTopic;

        // 按重要性和关系分层
        topics.forEach(topic => {
            const level = topic.level || 1;
            if (!hierarchy.levels.has(level)) {
                hierarchy.levels.set(level, []);
            }
            hierarchy.levels.get(level).push(topic);
        });

        return hierarchy;
    }

    /**
     * 分析时间线
     * @param {string} text - 文本
     * @param {object} context - 上下文
     * @returns {Array<object>} 时间线
     */
    async analyzeTimeline(text, context) {
        // 简化的时间线分析
        return [
            {
                timestamp: Date.now(),
                event: 'conversation_start',
                description: '对话开始'
            }
        ];
    }

    /**
     * 分割句子
     * @param {string} text - 文本
     * @returns {Array<string>} 句子数组
     */
    splitIntoSentences(text) {
        return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    }

    /**
     * 提取关键词
     * @param {string} sentence - 句子
     * @returns {Array<string>} 关键词
     */
    extractKeywords(sentence) {
        const words = sentence.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
            
        return words.slice(0, 5); // 限制关键词数量
    }

    /**
     * 提取主题文本
     * @param {string} sentence - 句子
     * @param {Array<string>} keywords - 关键词
     * @returns {string} 主题文本
     */
    extractTopicText(sentence, keywords) {
        if (keywords.length > 0) {
            return keywords[0]; // 使用第一个关键词作为主题
        }
        return sentence.substring(0, 30) + '...'; // 截取句子开头
    }

    /**
     * 计算重要性
     * @param {string} sentence - 句子
     * @param {Array<string>} keywords - 关键词
     * @returns {number} 重要性分数
     */
    calculateImportance(sentence, keywords) {
        let score = 0.5; // 基础分数
        
        // 关键词数量影响
        score += keywords.length * 0.1;
        
        // 句子长度影响
        score += Math.min(sentence.length / 100, 0.3);
        
        // 特殊模式识别
        for (const [type, pattern] of this.topicPatterns) {
            if (pattern.test(sentence)) {
                score += 0.2;
                break;
            }
        }
        
        return Math.min(score, 1.0);
    }

    /**
     * 确定层级
     * @param {number} index - 索引
     * @param {number} total - 总数
     * @returns {number} 层级
     */
    determineLevel(index, total) {
        if (index === 0) return 1; // 第一个是根级别
        if (index < total * 0.3) return 2; // 前30%是二级
        return 3; // 其他是三级
    }

    /**
     * 文本分类
     * @param {string} text - 文本
     * @returns {string} 类别
     */
    categorizeText(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('technology') || lowerText.includes('technical')) {
            return 'technology';
        }
        if (lowerText.includes('business') || lowerText.includes('project')) {
            return 'business';
        }
        if (lowerText.includes('person') || lowerText.includes('team')) {
            return 'person';
        }
        
        return 'general';
    }

    /**
     * 查找关系
     * @param {object} source - 源主题
     * @param {object} target - 目标主题
     * @param {string} text - 文本
     * @returns {object|null} 关系对象
     */
    findRelationship(source, target, text) {
        // 简化的关系识别
        const distance = Math.abs(source.position - target.position);
        
        if (distance <= 2) {
            return {
                source: source.text,
                target: target.text,
                type: 'sequence',
                strength: 1.0 / distance,
                label: '序列关系'
            };
        }
        
        // 检查关键词重叠
        const commonKeywords = source.keywords.filter(k => target.keywords.includes(k));
        if (commonKeywords.length > 0) {
            return {
                source: source.text,
                target: target.text,
                type: 'related',
                strength: commonKeywords.length / Math.max(source.keywords.length, target.keywords.length),
                label: '相关关系'
            };
        }
        
        return null;
    }
}

/**
 * 图形构建器
 */
class GraphBuilder {
    constructor() {
        this.nodeId = 0;
        this.edgeId = 0;
    }

    /**
     * 构建图形
     * @param {Array<object>} topics - 主题
     * @param {Array<object>} relationships - 关系
     * @returns {object} 图形对象
     */
    buildGraph(topics, relationships) {
        const nodes = topics.map(topic => this.createNode(topic));
        const edges = relationships.map(rel => this.createEdge(rel));
        
        return { nodes, edges };
    }

    /**
     * 创建节点
     * @param {object} topic - 主题
     * @returns {object} 节点
     */
    createNode(topic) {
        return {
            id: `node_${this.nodeId++}`,
            label: topic.text,
            weight: topic.importance,
            category: topic.category
        };
    }

    /**
     * 创建边
     * @param {object} relationship - 关系
     * @returns {object} 边
     */
    createEdge(relationship) {
        return {
            id: `edge_${this.edgeId++}`,
            source: relationship.source,
            target: relationship.target,
            weight: relationship.strength
        };
    }
}

/**
 * 布局引擎
 */
class LayoutEngine {
    constructor() {
        this.algorithms = {
            'radial': this.radialLayout.bind(this),
            'force': this.forceLayout.bind(this),
            'hierarchical': this.hierarchicalLayout.bind(this)
        };
    }

    /**
     * 计算布局
     * @param {Map} nodes - 节点集合
     * @param {Map} connections - 连接集合
     * @param {string} algorithm - 布局算法
     * @returns {object} 布局结果
     */
    async calculateLayout(nodes, connections, algorithm = 'radial') {
        const layoutFn = this.algorithms[algorithm] || this.algorithms['radial'];
        return await layoutFn(nodes, connections);
    }

    /**
     * 径向布局
     * @param {Map} nodes - 节点
     * @param {Map} connections - 连接
     * @returns {object} 布局
     */
    async radialLayout(nodes, connections) {
        const nodeArray = Array.from(nodes.values());
        const center = { x: 400, y: 300 }; // 布局中心
        const radius = 200; // 基础半径
        
        nodeArray.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / nodeArray.length;
            const levelRadius = radius * (node.level || 1);
            
            node.position = {
                x: center.x + levelRadius * Math.cos(angle),
                y: center.y + levelRadius * Math.sin(angle)
            };
        });

        return {
            type: 'radial',
            center: center,
            bounds: { width: 800, height: 600 }
        };
    }

    /**
     * 力导向布局
     * @param {Map} nodes - 节点
     * @param {Map} connections - 连接
     * @returns {object} 布局
     */
    async forceLayout(nodes, connections) {
        // 简化的力导向布局
        const nodeArray = Array.from(nodes.values());
        
        nodeArray.forEach((node, index) => {
            node.position = {
                x: Math.random() * 800,
                y: Math.random() * 600
            };
        });

        return {
            type: 'force',
            center: { x: 400, y: 300 },
            bounds: { width: 800, height: 600 }
        };
    }

    /**
     * 层次布局
     * @param {Map} nodes - 节点
     * @param {Map} connections - 连接
     * @returns {object} 布局
     */
    async hierarchicalLayout(nodes, connections) {
        const nodeArray = Array.from(nodes.values());
        const levels = new Map();
        
        // 按层级分组
        nodeArray.forEach(node => {
            const level = node.level || 1;
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level).push(node);
        });

        // 计算位置
        let yOffset = 50;
        const levelHeight = 150;
        
        for (const [level, levelNodes] of levels) {
            const xStep = 800 / (levelNodes.length + 1);
            
            levelNodes.forEach((node, index) => {
                node.position = {
                    x: xStep * (index + 1),
                    y: yOffset
                };
            });
            
            yOffset += levelHeight;
        }

        return {
            type: 'hierarchical',
            center: { x: 400, y: 300 },
            bounds: { width: 800, height: yOffset }
        };
    }
}

module.exports = MindMapService;