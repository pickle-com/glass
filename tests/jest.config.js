module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    
    // Files to include in coverage
    collectCoverageFrom: [
        'src/common/config/languages.js',
        'src/features/settings/settingsService.js',
        'src/features/settings/SettingsView.js',
        'src/common/ai/providers/*.js',
        'src/features/listen/stt/sttService.js',
        'src/features/ask/askService.js',
        'src/features/listen/summary/summaryService.js',
        'src/app/PickleGlassApp.js'
    ],
    
    // Ignore patterns
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '/coverage/',
        '/.git/',
        '/build/',
        '/dist/'
    ],
    
    // Module name mapping for mocking
    moduleNameMapping: {
        '^electron$': '<rootDir>/tests/mocks/electron.js'
    },
    
    // Transform configuration
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks after each test
    restoreMocks: true,
    
    // Error handling
    errorOnDeprecated: true,
    
    // Global setup and teardown
    globalSetup: '<rootDir>/tests/globalSetup.js',
    globalTeardown: '<rootDir>/tests/globalTeardown.js'
}; 