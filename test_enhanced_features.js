/**
 * Glass Enhanced Features - 功能测试脚本
 * 测试所有增强功能的基本工作流程
 */

const EnhancedService = require('./src/features/enhanced/enhancedService');

async function testEnhancedFeatures() {
    console.log('🚀 Starting Glass Enhanced Features Test\n');

    // 创建服务实例
    const enhancedService = new EnhancedService();

    try {
        // 1. 初始化服务
        console.log('1️⃣ Initializing enhanced services...');
        const initialized = await enhancedService.initialize();
        
        if (!initialized) {
            throw new Error('Failed to initialize enhanced services');
        }
        console.log('✅ All services initialized successfully\n');

        // 2. 测试转录处理
        console.log('2️⃣ Testing transcription processing...');
        const testTranscription = {
            speaker: 'User',
            text: 'We need to discuss the new API architecture for our database project. The implementation should focus on scalability and performance.',
            timestamp: Date.now(),
            sessionId: 'test-session-001'
        };

        await enhancedService.processTranscription(testTranscription);
        console.log('✅ Transcription processed successfully\n');

        // 3. 测试网页内容处理
        console.log('3️⃣ Testing web content processing...');
        const testWebContent = {
            content: 'Modern software architecture patterns include microservices, event-driven design, and serverless computing. These patterns help create scalable and maintainable applications.',
            url: 'https://example.com/architecture-patterns',
            title: 'Software Architecture Patterns',
            timestamp: Date.now()
        };

        await enhancedService.processWebContent(testWebContent);
        console.log('✅ Web content processed successfully\n');

        // 4. 测试术语定义获取
        console.log('4️⃣ Testing term definitions...');
        const definition = await enhancedService.getTermDefinition('api', {
            text: 'API architecture discussion',
            sessionId: 'test-session-001'
        });

        if (definition) {
            console.log('📖 Definition found:', definition.definition);
        }
        console.log('✅ Term definition test completed\n');

        // 5. 测试思维导图生成
        console.log('5️⃣ Testing mind map generation...');
        const mindMap = enhancedService.getCurrentMindMap();
        
        if (mindMap) {
            console.log('🗺️ Mind map generated:');
            console.log(`  - Nodes: ${mindMap.nodes.length}`);
            console.log(`  - Edges: ${mindMap.edges.length}`);
        }
        console.log('✅ Mind map test completed\n');

        // 6. 测试服务状态
        console.log('6️⃣ Checking service status...');
        const status = enhancedService.getServicesStatus();
        console.log('📊 Service Status:');
        console.log(`  - Enhanced: ${status.enhanced.isEnabled ? '✅' : '❌'} (${status.enhanced.isInitialized ? 'initialized' : 'not initialized'})`);
        console.log(`  - Translation: ${status.translation.isEnabled ? '✅' : '❌'} (${status.translation.cacheSize} cached items)`);
        console.log(`  - Keywords: ${status.keywords.isEnabled ? '✅' : '❌'} (${status.keywords.domainKeywordsCount} domain keywords)`);
        console.log(`  - Glossary: ${status.glossary.isEnabled ? '✅' : '❌'} (${status.glossary.defaultDefinitions} definitions)`);
        console.log(`  - MindMap: ${status.mindmap.isEnabled ? '✅' : '❌'} (${status.mindmap.nodeCount} nodes)`);

        // 7. 测试批量术语处理
        console.log('\n7️⃣ Testing batch term processing...');
        const terms = ['architecture', 'database', 'scalability', 'api'];
        const batchDefinitions = await enhancedService.glossaryService.batchGetDefinitions(terms);
        console.log(`📚 Found definitions for ${batchDefinitions.size} terms`);

        // 8. 测试数据导出
        console.log('\n8️⃣ Testing data export...');
        const exportedData = enhancedService.exportData();
        console.log('💾 Data export completed:', {
            hasMindMap: !!exportedData.mindMap,
            hasGlossary: !!exportedData.glossary,
            timestamp: new Date(exportedData.timestamp).toISOString()
        });

        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📈 Test Summary:');
        console.log('  ✅ Service initialization');
        console.log('  ✅ Transcription processing');
        console.log('  ✅ Web content processing');
        console.log('  ✅ Term definition retrieval');
        console.log('  ✅ Mind map generation');
        console.log('  ✅ Service status monitoring');
        console.log('  ✅ Batch term processing');
        console.log('  ✅ Data export functionality');

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testEnhancedFeatures()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { testEnhancedFeatures };