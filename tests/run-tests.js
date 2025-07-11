#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Running Multi-Language Support Tests...\n');

// Check if required files exist
const requiredFiles = [
    'src/common/config/languages.js',
    'src/features/settings/settingsService.js',
    'src/features/settings/SettingsView.js',
    'src/app/PickleGlassApp.js'
];

console.log('📋 Checking required files...');
let missingFiles = [];

requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
        missingFiles.push(file);
        console.log(`❌ Missing: ${file}`);
    } else {
        console.log(`✅ Found: ${file}`);
    }
});

if (missingFiles.length > 0) {
    console.log(`\n❌ Missing ${missingFiles.length} required files. Please ensure all files are present.`);
    process.exit(1);
}

console.log('\n✅ All required files found!\n');

// Test configuration
const testConfig = {
    // Test suites to run
    suites: [
        'tests/languages.unit.test.js',
        'tests/multilang-integration.test.js',
        'tests/multilang-e2e.test.js'
    ],
    
    // Jest options
    jestOptions: [
        '--config=tests/jest.config.js',
        '--verbose',
        '--coverage',
        '--detectOpenHandles',
        '--forceExit'
    ]
};

// Function to run a single test suite
function runTestSuite(suitePath) {
    return new Promise((resolve, reject) => {
        console.log(`🔍 Running ${suitePath}...`);
        
        const jest = spawn('npx', ['jest', suitePath, ...testConfig.jestOptions], {
            stdio: 'pipe',
            shell: true
        });
        
        let output = '';
        let errorOutput = '';
        
        jest.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        jest.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        jest.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${suitePath} passed`);
                resolve({ success: true, output });
            } else {
                console.log(`❌ ${suitePath} failed`);
                reject({ success: false, output, errorOutput, code });
            }
        });
    });
}

// Function to run all tests
async function runAllTests() {
    const results = [];
    let totalPassed = 0;
    let totalFailed = 0;
    
    console.log('🚀 Starting test execution...\n');
    
    for (const suite of testConfig.suites) {
        try {
            const result = await runTestSuite(suite);
            results.push({ suite, ...result });
            totalPassed++;
        } catch (error) {
            results.push({ suite, ...error });
            totalFailed++;
            
            // Show error details
            console.log(`\n📝 Error details for ${suite}:`);
            console.log(error.errorOutput || error.output);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    results.forEach(result => {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${status} - ${result.suite}`);
    });
    
    console.log(`\n📈 Results: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (totalFailed > 0) {
        console.log('\n❌ Some tests failed. Please check the output above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed! Multi-language support is working correctly.');
        process.exit(0);
    }
}

// Function to run a quick validation test
function runQuickValidation() {
    console.log('⚡ Running quick validation...\n');
    
    try {
        // Test 1: Language configuration
        const { getAvailableLanguages, isValidLanguageCode, getLanguageForProvider } = require('../src/common/config/languages');
        
        console.log('🔍 Testing language configuration...');
        const languages = getAvailableLanguages();
        console.log(`✅ Found ${languages.length} supported languages`);
        
        // Test key languages
        const keyLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
        keyLanguages.forEach(lang => {
            if (isValidLanguageCode(lang)) {
                console.log(`✅ ${lang} - valid`);
            } else {
                console.log(`❌ ${lang} - invalid`);
            }
        });
        
        // Test provider mappings
        console.log('\n🔍 Testing provider mappings...');
        const providers = ['openai', 'gemini', 'whisper'];
        providers.forEach(provider => {
            const langCode = getLanguageForProvider('en', provider);
            console.log(`✅ ${provider}: en -> ${langCode}`);
        });
        
        console.log('\n✅ Quick validation passed!');
        return true;
        
    } catch (error) {
        console.log(`❌ Quick validation failed: ${error.message}`);
        return false;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        // Run quick validation only
        const success = runQuickValidation();
        process.exit(success ? 0 : 1);
    } else if (args.includes('--help')) {
        // Show help
        console.log('Multi-Language Test Runner');
        console.log('');
        console.log('Usage:');
        console.log('  node tests/run-tests.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --quick    Run quick validation only');
        console.log('  --help     Show this help message');
        console.log('');
        console.log('Test Suites:');
        testConfig.suites.forEach(suite => {
            console.log(`  - ${suite}`);
        });
        process.exit(0);
    } else {
        // Run full test suite
        await runAllTests();
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the main function
main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
}); 