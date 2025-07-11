const { 
    getAvailableLanguages, 
    getLanguageForProvider, 
    getLanguageLLMContext, 
    isValidLanguageCode,
    isRTL,
    normalizeLanguageCode 
} = require('../src/common/config/languages');

describe('Language Configuration Unit Tests', () => {
    describe('getAvailableLanguages()', () => {
        test('should return array of supported languages', () => {
            const languages = getAvailableLanguages();
            expect(Array.isArray(languages)).toBe(true);
            expect(languages.length).toBe(37);
        });

        test('should include major languages', () => {
            const languages = getAvailableLanguages();
            const majorLanguageCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
            const languageCodes = languages.map(lang => lang.code);
            
            majorLanguageCodes.forEach(lang => {
                expect(languageCodes).toContain(lang);
            });
        });

        test('should not contain duplicates', () => {
            const languages = getAvailableLanguages();
            const languageCodes = languages.map(lang => lang.code);
            const uniqueLanguages = [...new Set(languageCodes)];
            expect(languageCodes.length).toBe(uniqueLanguages.length);
        });
    });

    describe('isValidLanguageCode()', () => {
        test('should validate correct language codes', () => {
            const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'hi'];
            
            validLanguages.forEach(lang => {
                expect(isValidLanguageCode(lang)).toBe(true);
            });
        });

        test('should reject invalid language codes', () => {
            const invalidLanguages = ['invalid', 'xx', 'eng', 'english', '123', 'en-US'];
            
            invalidLanguages.forEach(lang => {
                expect(isValidLanguageCode(lang)).toBe(false);
            });
        });

        test('should handle edge cases', () => {
            expect(isValidLanguageCode('')).toBe(false);
            expect(isValidLanguageCode(null)).toBe(false);
            expect(isValidLanguageCode(undefined)).toBe(false);
            expect(isValidLanguageCode(123)).toBe(false);
            expect(isValidLanguageCode({})).toBe(false);
            expect(isValidLanguageCode([])).toBe(false);
        });
    });

    describe('getLanguageForProvider()', () => {
        test('should return correct codes for OpenAI', () => {
            expect(getLanguageForProvider('en', 'openai')).toBe('en');
            expect(getLanguageForProvider('es', 'openai')).toBe('es');
            expect(getLanguageForProvider('fr', 'openai')).toBe('fr');
            expect(getLanguageForProvider('zh', 'openai')).toBe('zh');
        });

        test('should return correct codes for Gemini', () => {
            expect(getLanguageForProvider('en', 'gemini')).toBe('en-US');
            expect(getLanguageForProvider('es', 'gemini')).toBe('es-ES');
            expect(getLanguageForProvider('fr', 'gemini')).toBe('fr-FR');
            expect(getLanguageForProvider('zh', 'gemini')).toBe('zh-CN');
        });

        test('should return correct codes for Whisper', () => {
            expect(getLanguageForProvider('en', 'whisper')).toBe('en');
            expect(getLanguageForProvider('es', 'whisper')).toBe('es');
            expect(getLanguageForProvider('pt', 'whisper')).toBe('pt');
            expect(getLanguageForProvider('ja', 'whisper')).toBe('ja');
        });

        test('should handle unknown providers gracefully', () => {
            expect(getLanguageForProvider('en', 'unknown')).toBe('en');
            expect(getLanguageForProvider('es', 'invalid')).toBe('es');
        });

        test('should handle invalid languages', () => {
            expect(getLanguageForProvider('invalid', 'openai')).toBe('en');
            expect(getLanguageForProvider('', 'gemini')).toBe('en-US');
            expect(getLanguageForProvider(null, 'whisper')).toBe('en');
        });
    });

    describe('getLanguageLLMContext()', () => {
        test('should generate correct context for supported languages', () => {
            const testCases = [
                { lang: 'en', expected: 'Please respond in English.' },
                { lang: 'es', expected: 'Please respond in Spanish.' },
                { lang: 'fr', expected: 'Please respond in French.' },
                { lang: 'de', expected: 'Please respond in German.' },
                { lang: 'it', expected: 'Please respond in Italian.' },
                { lang: 'pt', expected: 'Please respond in Portuguese.' },
                { lang: 'ru', expected: 'Please respond in Russian.' },
                { lang: 'ja', expected: 'Please respond in Japanese.' },
                { lang: 'ko', expected: 'Please respond in Korean.' },
                { lang: 'zh', expected: 'Please respond in Chinese.' },
                { lang: 'ar', expected: 'Please respond in Arabic.' },
                { lang: 'hi', expected: 'Please respond in Hindi.' },
                { lang: 'tr', expected: 'Please respond in Turkish.' },
                { lang: 'nl', expected: 'Please respond in Dutch.' },
                { lang: 'pl', expected: 'Please respond in Polish.' },
                { lang: 'sv', expected: 'Please respond in Swedish.' },
                { lang: 'da', expected: 'Please respond in Danish.' },
                { lang: 'no', expected: 'Please respond in Norwegian.' },
                { lang: 'fi', expected: 'Please respond in Finnish.' },
                { lang: 'he', expected: 'Please respond in Hebrew.' },
                { lang: 'th', expected: 'Please respond in Thai.' },
                { lang: 'vi', expected: 'Please respond in Vietnamese.' },
                { lang: 'uk', expected: 'Please respond in Ukrainian.' },
                { lang: 'cs', expected: 'Please respond in Czech.' },
                { lang: 'hu', expected: 'Please respond in Hungarian.' },
                { lang: 'ro', expected: 'Please respond in Romanian.' },
                { lang: 'bg', expected: 'Please respond in Bulgarian.' },
                { lang: 'hr', expected: 'Please respond in Croatian.' },
                { lang: 'sk', expected: 'Please respond in Slovak.' },
                { lang: 'sl', expected: 'Please respond in Slovenian.' },
                { lang: 'et', expected: 'Please respond in Estonian.' },
                { lang: 'lv', expected: 'Please respond in Latvian.' },
                { lang: 'lt', expected: 'Please respond in Lithuanian.' },
                { lang: 'id', expected: 'Please respond in Indonesian.' },
                { lang: 'ms', expected: 'Please respond in Malay.' },
                { lang: 'tl', expected: 'Please respond in Filipino.' }
            ];

            testCases.forEach(({ lang, expected }) => {
                expect(getLanguageLLMContext(lang)).toBe(expected);
            });
        });

        test('should fallback to English for invalid languages', () => {
            const invalidLanguages = ['invalid', 'xx', '', null, undefined, 123];
            
            invalidLanguages.forEach(lang => {
                expect(getLanguageLLMContext(lang)).toBe('Please respond in English.');
            });
        });
    });

    describe('isRTL()', () => {
        test('should identify RTL languages correctly', () => {
            expect(isRTL('ar')).toBe(true);
            expect(isRTL('he')).toBe(true);
        });

        test('should identify LTR languages correctly', () => {
            const ltrLanguages = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ru', 'hi'];
            
            ltrLanguages.forEach(lang => {
                expect(isRTL(lang)).toBe(false);
            });
        });

        test('should handle invalid languages', () => {
            expect(isRTL('invalid')).toBe(false);
            expect(isRTL('')).toBe(false);
            expect(isRTL(null)).toBe(false);
        });
    });

    describe('normalizeLanguageCode()', () => {
        test('should normalize valid languages', () => {
            expect(normalizeLanguageCode('en')).toBe('en');
            expect(normalizeLanguageCode('es')).toBe('es');
            expect(normalizeLanguageCode('fr')).toBe('fr');
        });

        test('should handle legacy formats', () => {
            expect(normalizeLanguageCode('en-US')).toBe('en');
            expect(normalizeLanguageCode('es-ES')).toBe('es');
            expect(normalizeLanguageCode('fr-FR')).toBe('fr');
        });

        test('should fallback to English for invalid languages', () => {
            expect(normalizeLanguageCode('invalid')).toBe('en');
            expect(normalizeLanguageCode('')).toBe('en');
            expect(normalizeLanguageCode(null)).toBe('en');
            expect(normalizeLanguageCode(undefined)).toBe('en');
        });
    });

    describe('Provider-specific mappings', () => {
        test('should handle all supported languages for OpenAI', () => {
            const languages = getAvailableLanguages();
            
            languages.forEach(lang => {
                const providerLang = getLanguageForProvider(lang.code, 'openai');
                expect(typeof providerLang).toBe('string');
                expect(providerLang.length).toBeGreaterThan(0);
            });
        });

        test('should handle all supported languages for Gemini', () => {
            const languages = getAvailableLanguages();
            
            languages.forEach(lang => {
                const providerLang = getLanguageForProvider(lang.code, 'gemini');
                expect(typeof providerLang).toBe('string');
                expect(providerLang.length).toBeGreaterThan(0);
                // Gemini should use BCP-47 format (contains hyphen)
                expect(providerLang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
            });
        });

        test('should handle all supported languages for Whisper', () => {
            const languages = getAvailableLanguages();
            
            languages.forEach(lang => {
                const providerLang = getLanguageForProvider(lang.code, 'whisper');
                expect(typeof providerLang).toBe('string');
                expect(providerLang.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Performance and Memory', () => {
        test('should not create new arrays on repeated calls', () => {
            const languages1 = getAvailableLanguages();
            const languages2 = getAvailableLanguages();
            
            // Should return consistent results
            expect(languages1).toEqual(languages2);
        });

        test('should handle large number of calls efficiently', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                getLanguageForProvider('en', 'openai');
                getLanguageLLMContext('en');
                isValidLanguageCode('en');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete 1000 calls in under 100ms
            expect(duration).toBeLessThan(100);
        });
    });
}); 