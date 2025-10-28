#!/usr/bin/env node

/**
 * Glass增强功能演示脚本
 * 演示所有新增功能的实际效果
 */

const path = require('path');
process.chdir(path.join(__dirname));

const EnhancedService = require('./src/features/enhanced/enhancedService');

class GlassEnhancedDemo {
    constructor() {
        this.enhancedService = new EnhancedService();
    }

    async runDemo() {
        console.log('\n🚀 Glass增强功能演示开始...\n');
        
        // 初始化服务
        console.log('📋 正在初始化增强服务...');
        const initialized = await this.enhancedService.initialize();
        
        if (!initialized) {
            console.error('❌ 服务初始化失败');
            return;
        }
        
        console.log('✅ 增强服务初始化成功\n');
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 演示各项功能
        await this.demoTranscriptionProcessing();
        await this.demoWebContentProcessing();
        await this.demoVideoLearning();
        await this.demoTermDefinitions();
        await this.demoMindMapping();
        await this.demoDataExport();
        
        console.log('\n🎉 演示完成！所有功能都已测试。');
        console.log('\n💡 如需在实际Glass应用中测试，请运行: npm start');
    }

    setupEventListeners() {
        console.log('🔧 设置事件监听器...');
        
        this.enhancedService.on('enhanced:processed', (data) => {
            console.log('📈 增强处理完成:', {
                taskId: data.taskId,
                hasTranslation: !!data.results.translation,
                keywordCount: data.results.keywords?.length || 0,
                hasMindMap: !!data.results.mindMap
            });
        });

        this.enhancedService.on('enhanced:translation', (data) => {
            console.log('🌍 翻译完成:', {
                original: data.originalText?.substring(0, 50) + '...',
                translated: data.translatedText?.substring(0, 50) + '...',
                from: data.sourceLanguage,
                to: data.targetLanguage
            });
        });

        this.enhancedService.on('enhanced:keywords', (data) => {
            console.log('🔑 关键词提取:', data.keywords.map(k => k.word).slice(0, 5));
        });

        this.enhancedService.on('enhanced:definitions', (data) => {
            const terms = Object.keys(data.definitions);
            console.log('📚 术语定义:', terms.slice(0, 3));
        });

        this.enhancedService.on('enhanced:video_session_started', (data) => {
            console.log('🎥 视频学习会话开始:', data.sessionId);
        });

        this.enhancedService.on('enhanced:video_learning', (data) => {
            console.log('📹 视频OCR文本处理:', {
                text: data.originalText?.substring(0, 30) + '...',
                confidence: data.confidence,
                hasTranslation: !!data.translation
            });
        });

        console.log('✅ 事件监听器设置完成\n');
    }

    async demoTranscriptionProcessing() {
        console.log('🎤 演示1: 转录文本处理');
        console.log('─'.repeat(50));
        
        const sampleTranscriptions = [
            {
                speaker: 'John',
                text: 'We need to implement a new API architecture using microservices and containerization with Docker.',
                timestamp: Date.now(),
                sessionId: 'demo_session_1'
            },
            {
                speaker: 'Sarah',
                text: 'Let\'s discuss the machine learning model deployment strategy and MLOps pipeline.',
                timestamp: Date.now() + 1000,
                sessionId: 'demo_session_1'
            },
            {
                speaker: 'Mike',
                text: 'The database optimization requires indexing and query performance tuning.',
                timestamp: Date.now() + 2000,
                sessionId: 'demo_session_1'
            }
        ];

        for (const transcription of sampleTranscriptions) {
            console.log(`\n💬 处理 ${transcription.speaker} 的发言:`);
            console.log(`   "${transcription.text}"`);
            
            await this.enhancedService.processTranscription(transcription);
            await this.sleep(1000); // 等待处理完成
        }
        
        console.log('\n✅ 转录文本处理演示完成\n');
    }

    async demoWebContentProcessing() {
        console.log('🌐 演示2: 网页内容处理');
        console.log('─'.repeat(50));
        
        const sampleWebContent = [
            {
                content: 'React is a JavaScript library for building user interfaces. It was developed by Facebook and is now maintained by Meta. React uses a component-based architecture and virtual DOM for efficient rendering.',
                url: 'https://reactjs.org/docs',
                title: 'React Documentation',
                timestamp: Date.now()
            },
            {
                content: 'Artificial Intelligence (AI) and Machine Learning (ML) are transforming software development. Neural networks, deep learning, and natural language processing are key technologies.',
                url: 'https://ai-ml-guide.com',
                title: 'AI/ML in Software Development',
                timestamp: Date.now()
            }
        ];

        for (const webData of sampleWebContent) {
            console.log(`\n📄 处理网页内容: ${webData.title}`);
            console.log(`   URL: ${webData.url}`);
            console.log(`   内容: "${webData.content.substring(0, 80)}..."`);
            
            await this.enhancedService.processWebContent(webData);
            await this.sleep(1000);
        }
        
        console.log('\n✅ 网页内容处理演示完成\n');
    }

    async demoVideoLearning() {
        console.log('🎥 演示3: 视频学习功能');
        console.log('─'.repeat(50));
        
        console.log('\n📹 获取可用屏幕...');
        const screens = await this.enhancedService.getAvailableScreens();
        console.log(`   发现 ${screens.length} 个屏幕`);
        
        console.log('\n📊 视频学习服务状态:');
        const videoStatus = this.enhancedService.getServicesStatus().video;
        console.log('  ', JSON.stringify(videoStatus, null, 2));
        
        // 模拟视频OCR文本处理
        console.log('\n🔍 模拟视频OCR文本处理...');
        await this.enhancedService.processVideoOCRText({
            text: 'Introduction to Machine Learning: Supervised learning algorithms include linear regression, decision trees, and neural networks.',
            confidence: 85,
            timestamp: Date.now(),
            sessionId: 'video_demo_session',
            source: 'video_ocr',
            metadata: {
                engine: 'mock',
                processingTime: 200,
                frameSize: '1280x720'
            }
        });
        
        console.log('\n✅ 视频学习功能演示完成\n');
    }

    async demoTermDefinitions() {
        console.log('📚 演示4: 术语定义功能');
        console.log('─'.repeat(50));
        
        const technicalTerms = [
            'API',
            'microservices',
            'containerization',
            'machine learning',
            'neural networks',
            'virtual DOM'
        ];

        console.log('\n🔍 批量获取术语定义...');
        for (const term of technicalTerms) {
            const definition = await this.enhancedService.getTermDefinition(term, {
                context: 'software development',
                domain: 'technology'
            });
            
            if (definition) {
                console.log(`\n📖 ${term}:`);
                console.log(`   ${definition.definition.substring(0, 100)}...`);
            }
            
            await this.sleep(300);
        }
        
        console.log('\n✅ 术语定义演示完成\n');
    }

    async demoMindMapping() {
        console.log('🗺️ 演示5: 思维导图生成');
        console.log('─'.repeat(50));
        
        console.log('\n🧠 生成思维导图...');
        const mindMap = this.enhancedService.getCurrentMindMap();
        
        if (mindMap) {
            console.log('📈 思维导图结构:');
            console.log(`   节点数量: ${mindMap.nodes?.length || 0}`);
            console.log(`   边数量: ${mindMap.edges?.length || 0}`);
            console.log(`   中心主题: ${mindMap.centralTopic || '未定义'}`);
            
            if (mindMap.nodes && mindMap.nodes.length > 0) {
                console.log('\n🔍 主要概念:');
                mindMap.nodes.slice(0, 5).forEach((node, index) => {
                    console.log(`   ${index + 1}. ${node.name} (权重: ${node.weight || 0})`);
                });
            }
        } else {
            console.log('   💡 思维导图将在处理更多内容后生成');
        }
        
        console.log('\n✅ 思维导图演示完成\n');
    }

    async demoDataExport() {
        console.log('💾 演示6: 数据导出功能');
        console.log('─'.repeat(50));
        
        console.log('\n📤 导出增强数据...');
        const exportedData = this.enhancedService.exportData();
        
        console.log('📊 导出数据摘要:');
        console.log(`   导出时间: ${new Date(exportedData.timestamp).toLocaleString()}`);
        console.log(`   包含思维导图: ${!!exportedData.mindMap}`);
        console.log(`   包含术语库: ${!!exportedData.glossary}`);
        console.log(`   配置信息: ${!!exportedData.config}`);
        
        if (exportedData.glossary) {
            const definitionCount = Object.keys(exportedData.glossary).length;
            console.log(`   术语定义数量: ${definitionCount}`);
        }
        
        console.log('\n✅ 数据导出演示完成\n');
    }

    async demoServiceStatus() {
        console.log('📊 演示7: 服务状态监控');
        console.log('─'.repeat(50));
        
        const status = this.enhancedService.getServicesStatus();
        const stats = this.enhancedService.getStatistics();
        
        console.log('\n🔧 服务状态:');
        Object.entries(status).forEach(([service, serviceStatus]) => {
            if (typeof serviceStatus === 'object' && serviceStatus.isEnabled !== undefined) {
                console.log(`   ${service}: ${serviceStatus.isEnabled ? '✅ 启用' : '❌ 禁用'}`);
            }
        });
        
        console.log('\n📈 处理统计:');
        console.log(`   总任务数: ${stats.totalTasksProcessed || 0}`);
        console.log(`   队列大小: ${stats.queueSize || 0}`);
        console.log(`   运行时间: ${Math.round(stats.uptime / 1000)}秒`);
        
        console.log('\n✅ 服务状态监控演示完成\n');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 主函数
async function main() {
    const demo = new GlassEnhancedDemo();
    
    try {
        await demo.runDemo();
        await demo.demoServiceStatus();
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 Glass增强功能特性总结:');
        console.log('='.repeat(60));
        console.log('✅ 实时翻译 - 多语言支持，智能语言检测');
        console.log('✅ 关键词提取 - TF-IDF算法，领域特定词典');
        console.log('✅ 术语解释 - AI驱动定义，上下文相关');
        console.log('✅ 思维导图 - 对话结构分析，可视化展示');
        console.log('✅ 视频学习 - 屏幕捕获，OCR识别，智能分析');
        console.log('✅ Chrome扩展 - 网页内容处理，高亮功能');
        console.log('✅ 统一集成 - 事件驱动，并行处理');
        console.log('='.repeat(60));
        
        console.log('\n💡 在实际Glass应用中测试:');
        console.log('1. 运行: npm start');
        console.log('2. 在监听界面点击视频学习按钮');
        console.log('3. 开始会话并观察增强功能效果');
        console.log('4. 安装Chrome扩展体验网页增强');
        
    } catch (error) {
        console.error('\n❌ 演示过程中发生错误:', error.message);
    }
}

// 运行演示
if (require.main === module) {
    main().catch(console.error);
}

module.exports = GlassEnhancedDemo;