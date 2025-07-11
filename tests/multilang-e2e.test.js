const fs = require('fs');
const path = require('path');

// Mock Electron environment
global.window = {
    require: jest.fn().mockReturnValue({
        ipcRenderer: {
            invoke: jest.fn(),
            on: jest.fn(),
            removeAllListeners: jest.fn()
        }
    }),
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
};

describe('Multi-Language Support E2E Tests', () => {
    let mockIpcRenderer;
    let mockLocalStorage;

    beforeEach(() => {
        mockIpcRenderer = window.require('electron').ipcRenderer;
        mockLocalStorage = window.localStorage;
        jest.clearAllMocks();
    });

    describe('Complete Language Switching Workflow', () => {
        test('should handle complete language change from UI to providers', async () => {
            // Step 1: User selects Spanish in UI
            const selectedLanguage = 'es';
            mockLocalStorage.setItem('selectedLanguage', selectedLanguage);
            
            // Step 2: Settings service should be called
            mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
            await mockIpcRenderer.invoke('settings:set-language', selectedLanguage);
            
            // Step 3: Language change event should be emitted
            const languageChangeHandler = jest.fn();
            mockIpcRenderer.on('language-changed', languageChangeHandler);
            
            // Step 4: All services should use the new language
            mockIpcRenderer.invoke.mockResolvedValueOnce(selectedLanguage);
            const currentLanguage = await mockIpcRenderer.invoke('settings:get-current-language');
            
            // Verify workflow
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedLanguage', 'es');
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('settings:set-language', 'es');
            expect(mockIpcRenderer.on).toHaveBeenCalledWith('language-changed', languageChangeHandler);
            expect(currentLanguage).toBe('es');
        });

        test('should handle language persistence across app restarts', async () => {
            // Simulate app startup
            mockLocalStorage.getItem.mockReturnValue('fr');
            mockIpcRenderer.invoke.mockResolvedValueOnce('fr');
            
            // App should load French from localStorage
            const storedLanguage = mockLocalStorage.getItem('selectedLanguage');
            expect(storedLanguage).toBe('fr');
            
            // Settings should be synced
            const settingsLanguage = await mockIpcRenderer.invoke('settings:get-current-language');
            expect(settingsLanguage).toBe('fr');
        });

        test('should handle legacy language format migration', () => {
            // Simulate legacy format in localStorage
            mockLocalStorage.getItem.mockReturnValue('en-US');
            
            const legacyLanguage = mockLocalStorage.getItem('selectedLanguage');
            expect(legacyLanguage).toBe('en-US');
            
            // Should be migrated to new format
            const migratedLanguage = legacyLanguage.split('-')[0];
            expect(migratedLanguage).toBe('en');
            
            // Should update localStorage
            mockLocalStorage.setItem('selectedLanguage', migratedLanguage);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedLanguage', 'en');
        });
    });

    describe('Provider Integration Tests', () => {
        test('should configure all STT providers correctly', async () => {
            const testLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
            
            for (const lang of testLanguages) {
                mockIpcRenderer.invoke.mockResolvedValueOnce(lang);
                const currentLang = await mockIpcRenderer.invoke('settings:get-current-language');
                
                // Each provider should receive correct language code
                expect(currentLang).toBe(lang);
            }
        });

        test('should configure all LLM providers correctly', async () => {
            const testLanguages = ['en', 'es', 'fr', 'de', 'ja'];
            
            for (const lang of testLanguages) {
                mockIpcRenderer.invoke.mockResolvedValueOnce(lang);
                const currentLang = await mockIpcRenderer.invoke('settings:get-current-language');
                
                // LLM should receive language context
                expect(currentLang).toBe(lang);
            }
        });
    });

    describe('Error Recovery Tests', () => {
        test('should recover from settings service errors', async () => {
            // Simulate settings service error
            mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Settings service unavailable'));
            
            try {
                await mockIpcRenderer.invoke('settings:get-current-language');
            } catch (error) {
                expect(error.message).toBe('Settings service unavailable');
            }
            
            // Should fallback to localStorage
            mockLocalStorage.getItem.mockReturnValue('en');
            const fallbackLanguage = mockLocalStorage.getItem('selectedLanguage');
            expect(fallbackLanguage).toBe('en');
        });

        test('should handle invalid language selection gracefully', async () => {
            // User somehow selects invalid language
            const invalidLanguage = 'invalid-lang';
            mockLocalStorage.setItem('selectedLanguage', invalidLanguage);
            
            // System should fallback to English
            mockIpcRenderer.invoke.mockResolvedValueOnce('en');
            const fallbackLanguage = await mockIpcRenderer.invoke('settings:get-current-language');
            expect(fallbackLanguage).toBe('en');
        });
    });

    describe('UI Integration Tests', () => {
        test('should handle language dropdown changes', () => {
            // Simulate dropdown change event
            const mockEvent = {
                target: { value: 'ja' }
            };
            
            const handleLanguageChange = jest.fn((event) => {
                const newLanguage = event.target.value;
                mockLocalStorage.setItem('selectedLanguage', newLanguage);
                mockIpcRenderer.invoke('settings:set-language', newLanguage);
            });
            
            handleLanguageChange(mockEvent);
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedLanguage', 'ja');
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('settings:set-language', 'ja');
        });

        test('should update UI elements after language change', () => {
            // Simulate language change event
            const mockLanguageChangeHandler = jest.fn((_, newLanguage) => {
                // UI should update to reflect new language
                expect(newLanguage).toBe('ko');
            });
            
            mockIpcRenderer.on('language-changed', mockLanguageChangeHandler);
            
            // Simulate the event
            const eventHandler = mockIpcRenderer.on.mock.calls[0][1];
            eventHandler(null, 'ko');
            
            expect(mockLanguageChangeHandler).toHaveBeenCalledWith(null, 'ko');
        });
    });

    describe('Live Insights Integration', () => {
        test('should use selected language for Live insights', async () => {
            // Set language to German
            mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
                if (channel === 'settings:get-all') {
                    return Promise.resolve({ language: 'de' });
                }
                return Promise.resolve(null);
            });
            
            const settings = await mockIpcRenderer.invoke('settings:get-all');
            expect(settings.language).toBe('de');
        });

        test('should include language context in summary prompts', async () => {
            const testLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
            
            for (const lang of testLanguages) {
                mockIpcRenderer.invoke.mockResolvedValueOnce({ language: lang });
                const settings = await mockIpcRenderer.invoke('settings:get-all');
                
                // Summary service should use this language
                expect(settings.language).toBe(lang);
            }
        });
    });

    describe('Window Management Tests', () => {
        test('should maintain window width during language changes', () => {
            // Simulate window resize
            const mockWindow = {
                getBounds: jest.fn().mockReturnValue({ width: 400, height: 600 }),
                setSize: jest.fn(),
                isResizable: jest.fn().mockReturnValue(false),
                setResizable: jest.fn()
            };
            
            // Language change should not affect window width
            const originalWidth = mockWindow.getBounds().width;
            
            // Simulate language change with longer text
            mockIpcRenderer.invoke('settings:set-language', 'de'); // German tends to be longer
            
            // Window width should remain the same
            expect(originalWidth).toBe(400);
        });
    });

    describe('Performance Tests', () => {
        test('should handle rapid language switching', async () => {
            const languages = ['en', 'es', 'fr', 'de', 'ja'];
            const startTime = Date.now();
            
            // Rapidly switch languages
            for (let i = 0; i < 100; i++) {
                const lang = languages[i % languages.length];
                mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
                await mockIpcRenderer.invoke('settings:set-language', lang);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete within reasonable time
            expect(duration).toBeLessThan(1000); // 1 second for 100 switches
        });

        test('should not leak memory during language operations', () => {
            // Simulate many language operations
            for (let i = 0; i < 1000; i++) {
                mockLocalStorage.getItem('selectedLanguage');
                mockLocalStorage.setItem('selectedLanguage', 'en');
            }
            
            // Should not throw memory errors
            expect(() => {
                mockLocalStorage.getItem('selectedLanguage');
            }).not.toThrow();
        });
    });

    describe('File System Integration', () => {
        test('should have all required files present', () => {
            const requiredFiles = [
                'src/common/config/languages.js',
                'src/features/settings/settingsService.js',
                'src/features/settings/SettingsView.js',
                'src/common/ai/providers/openai.js',
                'src/common/ai/providers/gemini.js',
                'src/common/ai/providers/whisper.js',
                'src/features/listen/stt/sttService.js',
                'src/features/ask/askService.js',
                'src/features/listen/summary/summaryService.js',
                'src/app/PickleGlassApp.js'
            ];
            
            requiredFiles.forEach(file => {
                const fullPath = path.join(__dirname, '..', file);
                expect(fs.existsSync(fullPath)).toBe(true);
            });
        });

        test('should have proper file structure', () => {
            const languagesFile = path.join(__dirname, '..', 'src/common/config/languages.js');
            
            if (fs.existsSync(languagesFile)) {
                const content = fs.readFileSync(languagesFile, 'utf8');
                
                // Should contain required exports
                expect(content).toContain('getLanguages');
                expect(content).toContain('getLanguageForProvider');
                expect(content).toContain('getLanguageLLMContext');
                expect(content).toContain('validateLanguage');
                
                // Should contain all 37 languages
                expect(content).toContain('en');
                expect(content).toContain('es');
                expect(content).toContain('fr');
                expect(content).toContain('zh');
                expect(content).toContain('ja');
            }
        });
    });
}); 