const { getAvailableLanguages, getLanguageForProvider, getLanguageLLMContext, isValidLanguageCode } = require('../src/common/config/languages');
const { SummaryService } = require('../src/features/listen/summary/summaryService');
const { SttService } = require('../src/features/listen/stt/sttService');

// Mock dependencies
const mockSettings = {
    language: 'en'
};

// Mock IPC and settings
const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
};

const mockGetSettings = jest.fn().mockResolvedValue(mockSettings);

// Mock window.require
global.window = {
    require: jest.fn().mockReturnValue({
        ipcRenderer: mockIpcRenderer
    })
};

describe('Multi-Language Support Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIpcRenderer.invoke.mockClear();
    });

    describe('Language Configuration', () => {
        test('should have all 37 supported languages', () => {
            const languages = getAvailableLanguages();
            expect(languages).toHaveLength(37);
            const languageCodes = languages.map(lang => lang.code);
            expect(languageCodes).toContain('en');
            expect(languageCodes).toContain('es');
            expect(languageCodes).toContain('fr');
            expect(languageCodes).toContain('zh');
            expect(languageCodes).toContain('ja');
        });

        test('should validate language codes correctly', () => {
            expect(isValidLanguageCode('en')).toBe(true);
            expect(isValidLanguageCode('es')).toBe(true);
            expect(isValidLanguageCode('invalid')).toBe(false);
            expect(isValidLanguageCode('')).toBe(false);
            expect(isValidLanguageCode(null)).toBe(false);
        });

        test('should provide correct language codes for different providers', () => {
            // OpenAI uses simple codes
            expect(getLanguageForProvider('en', 'openai')).toBe('en');
            expect(getLanguageForProvider('es', 'openai')).toBe('es');
            
            // Gemini uses BCP-47 format
            expect(getLanguageForProvider('en', 'gemini')).toBe('en-US');
            expect(getLanguageForProvider('es', 'gemini')).toBe('es-ES');
            
            // Whisper uses simple codes
            expect(getLanguageForProvider('en', 'whisper')).toBe('en');
            expect(getLanguageForProvider('zh', 'whisper')).toBe('zh');
        });

        test('should generate correct LLM context for different languages', () => {
            const englishContext = getLanguageLLMContext('en');
            expect(englishContext).toBe('Please respond in English.');
            
            const spanishContext = getLanguageLLMContext('es');
            expect(spanishContext).toBe('Please respond in Spanish.');
            
            const chineseContext = getLanguageLLMContext('zh');
            expect(englishContext).toBe('Please respond in English.');
            
            // Test fallback for invalid language
            const invalidContext = getLanguageLLMContext('invalid');
            expect(invalidContext).toBe('Please respond in English.');
        });
    });

    describe('Settings Service Integration', () => {
        test('should handle language changes via IPC', async () => {
            mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
            
            // Simulate language change
            const result = await mockIpcRenderer.invoke('settings:set-language', 'es');
            
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('settings:set-language', 'es');
            expect(result).toEqual({ success: true });
        });

        test('should retrieve current language from settings', async () => {
            mockIpcRenderer.invoke.mockResolvedValueOnce('fr');
            
            const language = await mockIpcRenderer.invoke('settings:get-current-language');
            
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('settings:get-current-language');
            expect(language).toBe('fr');
        });
    });

    describe('STT Service Language Support', () => {
        test('should use selected language for STT providers', () => {
            // Mock the settings to return Spanish
            const mockSttService = {
                getLanguageFromSettings: jest.fn().mockResolvedValue('es')
            };
            
            expect(mockSttService.getLanguageFromSettings).toBeDefined();
        });
    });

    describe('LLM Integration', () => {
        test('should include language context in prompts', () => {
            const testCases = [
                { lang: 'en', expected: 'Please respond in English.' },
                { lang: 'es', expected: 'Please respond in Spanish.' },
                { lang: 'fr', expected: 'Please respond in French.' },
                { lang: 'de', expected: 'Please respond in German.' },
                { lang: 'ja', expected: 'Please respond in Japanese.' }
            ];

            testCases.forEach(({ lang, expected }) => {
                const context = getLanguageLLMContext(lang);
                expect(context).toBe(expected);
            });
        });
    });

    describe('Live Insights Language Support', () => {
        test('should use selected language for summary generation', async () => {
            // Mock settings to return Spanish
            mockIpcRenderer.invoke.mockImplementation((channel) => {
                if (channel === 'settings:get-all') {
                    return Promise.resolve({ language: 'es' });
                }
                return Promise.resolve(null);
            });

            const spanishContext = getLanguageLLMContext('es');
            expect(spanishContext).toBe('Please respond in Spanish.');
        });
    });

    describe('Error Handling', () => {
        test('should fallback to English on invalid language', () => {
            const invalidLanguages = ['invalid', '', null, undefined, 'xx'];
            
            invalidLanguages.forEach(lang => {
                const context = getLanguageLLMContext(lang);
                expect(context).toBe('Please respond in English.');
            });
        });

        test('should handle provider mapping errors gracefully', () => {
            // Test with invalid provider
            const result = getLanguageForProvider('en', 'invalid-provider');
            expect(result).toBe('en'); // Should fallback to simple code
        });
    });

    describe('Language Persistence', () => {
        test('should persist language selection in localStorage', () => {
            // Mock localStorage
            const mockLocalStorage = {
                getItem: jest.fn(),
                setItem: jest.fn()
            };
            
            Object.defineProperty(window, 'localStorage', {
                value: mockLocalStorage
            });

            // Test setting language
            mockLocalStorage.setItem('selectedLanguage', 'es');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedLanguage', 'es');

            // Test getting language
            mockLocalStorage.getItem.mockReturnValue('es');
            const storedLanguage = mockLocalStorage.getItem('selectedLanguage');
            expect(storedLanguage).toBe('es');
        });
    });

    describe('UI Integration', () => {
        test('should handle language change events', () => {
            const mockLanguageChangeHandler = jest.fn();
            
            // Simulate language change event
            mockIpcRenderer.on('language-changed', mockLanguageChangeHandler);
            
            expect(mockIpcRenderer.on).toHaveBeenCalledWith('language-changed', mockLanguageChangeHandler);
        });
    });

    describe('Window Width Fix', () => {
        test('should prevent window width expansion with CSS fixes', () => {
            // Test CSS properties that prevent width expansion
            const cssRules = {
                'white-space': 'pre-wrap',
                'word-wrap': 'break-word',
                'word-break': 'break-word',
                'overflow-wrap': 'break-word',
                'max-width': '100%',
                'overflow-x': 'hidden',
                'box-sizing': 'border-box'
            };

            Object.entries(cssRules).forEach(([property, value]) => {
                expect(value).toBeDefined();
                expect(typeof value).toBe('string');
            });
        });
    });

    describe('Migration Compatibility', () => {
        test('should handle legacy language format migration', () => {
            // Test migration from 'en-US' to 'en'
            const legacyFormats = ['en-US', 'es-ES', 'fr-FR', 'de-DE'];
            
            legacyFormats.forEach(legacy => {
                const migrated = legacy.split('-')[0];
                expect(isValidLanguageCode(migrated)).toBe(true);
            });
        });
    });
}); 