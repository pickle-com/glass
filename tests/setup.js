// Global test setup
const path = require('path');

// Mock Electron
jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
    },
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
    },
    BrowserWindow: {
        fromWebContents: jest.fn(),
        getFocusedWindow: jest.fn()
    },
    app: {
        getPath: jest.fn().mockReturnValue('/mock/path'),
        quit: jest.fn()
    }
}));

// Mock Node.js modules
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    dirname: jest.fn(),
    basename: jest.fn(),
    extname: jest.fn()
}));

// Mock SQLite
jest.mock('sqlite3', () => ({
    Database: jest.fn().mockImplementation(() => ({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
        close: jest.fn()
    }))
}));

// Global test utilities
global.testUtils = {
    // Mock IPC response
    mockIpcResponse: (channel, response) => {
        const { ipcRenderer } = require('electron');
        ipcRenderer.invoke.mockImplementation((ch, ...args) => {
            if (ch === channel) {
                return Promise.resolve(response);
            }
            return Promise.resolve(null);
        });
    },

    // Mock localStorage
    mockLocalStorage: () => {
        const store = {};
        return {
            getItem: jest.fn((key) => store[key] || null),
            setItem: jest.fn((key, value) => {
                store[key] = value;
            }),
            removeItem: jest.fn((key) => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                Object.keys(store).forEach(key => delete store[key]);
            })
        };
    },

    // Mock settings
    mockSettings: (settings = {}) => {
        return {
            language: 'en',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            ...settings
        };
    },

    // Create test language data
    createTestLanguageData: () => ({
        en: { name: 'English', code: 'en' },
        es: { name: 'Spanish', code: 'es' },
        fr: { name: 'French', code: 'fr' },
        de: { name: 'German', code: 'de' },
        ja: { name: 'Japanese', code: 'ja' },
        zh: { name: 'Chinese', code: 'zh' }
    }),

    // Wait for async operations
    waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

    // Generate test event
    createMockEvent: (type, data = {}) => ({
        type,
        target: { value: data.value || '' },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ...data
    })
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Restore console for specific tests that need it
global.restoreConsole = () => {
    global.console = originalConsole;
};

// Setup DOM environment for UI tests
global.document = {
    createElement: jest.fn(() => ({
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        style: {},
        innerHTML: ''
    })),
    getElementById: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
};

global.window = {
    ...global.window,
    location: {
        search: '',
        href: 'http://localhost'
    },
    localStorage: global.testUtils.mockLocalStorage(),
    require: jest.fn()
};

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

// Global timeout for all tests
jest.setTimeout(10000); 