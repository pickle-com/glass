/**
 * Language configuration for multi-language support
 * Includes mappings for different STT and LLM providers
 */

// Common language codes and their display names
const LANGUAGES = {
    'en': {
        name: 'English',
        nativeName: 'English',
        // STT provider mappings
        openai: 'en',
        gemini: 'en-US',
        whisper: 'en',
        // LLM context
        llmContext: 'Please respond in English.',
        rtl: false
    },
    'es': {
        name: 'Spanish',
        nativeName: 'Español',
        openai: 'es',
        gemini: 'es-ES',
        whisper: 'es',
        llmContext: 'Please respond in Spanish.',
        rtl: false
    },
    'fr': {
        name: 'French',
        nativeName: 'Français',
        openai: 'fr',
        gemini: 'fr-FR',
        whisper: 'fr',
        llmContext: 'Please respond in French.',
        rtl: false
    },
    'de': {
        name: 'German',
        nativeName: 'Deutsch',
        openai: 'de',
        gemini: 'de-DE',
        whisper: 'de',
        llmContext: 'Please respond in German.',
        rtl: false
    },
    'it': {
        name: 'Italian',
        nativeName: 'Italiano',
        openai: 'it',
        gemini: 'it-IT',
        whisper: 'it',
        llmContext: 'Please respond in Italian.',
        rtl: false
    },
    'pt': {
        name: 'Portuguese',
        nativeName: 'Português',
        openai: 'pt',
        gemini: 'pt-BR',
        whisper: 'pt',
        llmContext: 'Please respond in Portuguese.',
        rtl: false
    },
    'ru': {
        name: 'Russian',
        nativeName: 'Русский',
        openai: 'ru',
        gemini: 'ru-RU',
        whisper: 'ru',
        llmContext: 'Please respond in Russian.',
        rtl: false
    },
    'ja': {
        name: 'Japanese',
        nativeName: '日本語',
        openai: 'ja',
        gemini: 'ja-JP',
        whisper: 'ja',
        llmContext: 'Please respond in Japanese.',
        rtl: false
    },
    'ko': {
        name: 'Korean',
        nativeName: '한국어',
        openai: 'ko',
        gemini: 'ko-KR',
        whisper: 'ko',
        llmContext: 'Please respond in Korean.',
        rtl: false
    },
    'zh': {
        name: 'Chinese (Simplified)',
        nativeName: '中文（简体）',
        openai: 'zh',
        gemini: 'zh-CN',
        whisper: 'zh',
        llmContext: 'Please respond in Chinese (Simplified).',
        rtl: false
    },
    'zh-TW': {
        name: 'Chinese (Traditional)',
        nativeName: '中文（繁體）',
        openai: 'zh',
        gemini: 'zh-TW',
        whisper: 'zh',
        llmContext: 'Please respond in Chinese (Traditional).',
        rtl: false
    },
    'ar': {
        name: 'Arabic',
        nativeName: 'العربية',
        openai: 'ar',
        gemini: 'ar-SA',
        whisper: 'ar',
        llmContext: 'Please respond in Arabic.',
        rtl: true
    },
    'hi': {
        name: 'Hindi',
        nativeName: 'हिन्दी',
        openai: 'hi',
        gemini: 'hi-IN',
        whisper: 'hi',
        llmContext: 'Please respond in Hindi.',
        rtl: false
    },
    'tr': {
        name: 'Turkish',
        nativeName: 'Türkçe',
        openai: 'tr',
        gemini: 'tr-TR',
        whisper: 'tr',
        llmContext: 'Please respond in Turkish.',
        rtl: false
    },
    'nl': {
        name: 'Dutch',
        nativeName: 'Nederlands',
        openai: 'nl',
        gemini: 'nl-NL',
        whisper: 'nl',
        llmContext: 'Please respond in Dutch.',
        rtl: false
    },
    'pl': {
        name: 'Polish',
        nativeName: 'Polski',
        openai: 'pl',
        gemini: 'pl-PL',
        whisper: 'pl',
        llmContext: 'Please respond in Polish.',
        rtl: false
    },
    'sv': {
        name: 'Swedish',
        nativeName: 'Svenska',
        openai: 'sv',
        gemini: 'sv-SE',
        whisper: 'sv',
        llmContext: 'Please respond in Swedish.',
        rtl: false
    },
    'da': {
        name: 'Danish',
        nativeName: 'Dansk',
        openai: 'da',
        gemini: 'da-DK',
        whisper: 'da',
        llmContext: 'Please respond in Danish.',
        rtl: false
    },
    'no': {
        name: 'Norwegian',
        nativeName: 'Norsk',
        openai: 'no',
        gemini: 'no-NO',
        whisper: 'no',
        llmContext: 'Please respond in Norwegian.',
        rtl: false
    },
    'fi': {
        name: 'Finnish',
        nativeName: 'Suomi',
        openai: 'fi',
        gemini: 'fi-FI',
        whisper: 'fi',
        llmContext: 'Please respond in Finnish.',
        rtl: false
    },
    'he': {
        name: 'Hebrew',
        nativeName: 'עברית',
        openai: 'he',
        gemini: 'he-IL',
        whisper: 'he',
        llmContext: 'Please respond in Hebrew.',
        rtl: true
    },
    'th': {
        name: 'Thai',
        nativeName: 'ไทย',
        openai: 'th',
        gemini: 'th-TH',
        whisper: 'th',
        llmContext: 'Please respond in Thai.',
        rtl: false
    },
    'vi': {
        name: 'Vietnamese',
        nativeName: 'Tiếng Việt',
        openai: 'vi',
        gemini: 'vi-VN',
        whisper: 'vi',
        llmContext: 'Please respond in Vietnamese.',
        rtl: false
    },
    'uk': {
        name: 'Ukrainian',
        nativeName: 'Українська',
        openai: 'uk',
        gemini: 'uk-UA',
        whisper: 'uk',
        llmContext: 'Please respond in Ukrainian.',
        rtl: false
    },
    'cs': {
        name: 'Czech',
        nativeName: 'Čeština',
        openai: 'cs',
        gemini: 'cs-CZ',
        whisper: 'cs',
        llmContext: 'Please respond in Czech.',
        rtl: false
    },
    'hu': {
        name: 'Hungarian',
        nativeName: 'Magyar',
        openai: 'hu',
        gemini: 'hu-HU',
        whisper: 'hu',
        llmContext: 'Please respond in Hungarian.',
        rtl: false
    },
    'ro': {
        name: 'Romanian',
        nativeName: 'Română',
        openai: 'ro',
        gemini: 'ro-RO',
        whisper: 'ro',
        llmContext: 'Please respond in Romanian.',
        rtl: false
    },
    'bg': {
        name: 'Bulgarian',
        nativeName: 'Български',
        openai: 'bg',
        gemini: 'bg-BG',
        whisper: 'bg',
        llmContext: 'Please respond in Bulgarian.',
        rtl: false
    },
    'hr': {
        name: 'Croatian',
        nativeName: 'Hrvatski',
        openai: 'hr',
        gemini: 'hr-HR',
        whisper: 'hr',
        llmContext: 'Please respond in Croatian.',
        rtl: false
    },
    'sk': {
        name: 'Slovak',
        nativeName: 'Slovenčina',
        openai: 'sk',
        gemini: 'sk-SK',
        whisper: 'sk',
        llmContext: 'Please respond in Slovak.',
        rtl: false
    },
    'sl': {
        name: 'Slovenian',
        nativeName: 'Slovenščina',
        openai: 'sl',
        gemini: 'sl-SI',
        whisper: 'sl',
        llmContext: 'Please respond in Slovenian.',
        rtl: false
    },
    'et': {
        name: 'Estonian',
        nativeName: 'Eesti',
        openai: 'et',
        gemini: 'et-EE',
        whisper: 'et',
        llmContext: 'Please respond in Estonian.',
        rtl: false
    },
    'lv': {
        name: 'Latvian',
        nativeName: 'Latviešu',
        openai: 'lv',
        gemini: 'lv-LV',
        whisper: 'lv',
        llmContext: 'Please respond in Latvian.',
        rtl: false
    },
    'lt': {
        name: 'Lithuanian',
        nativeName: 'Lietuvių',
        openai: 'lt',
        gemini: 'lt-LT',
        whisper: 'lt',
        llmContext: 'Please respond in Lithuanian.',
        rtl: false
    },
    'id': {
        name: 'Indonesian',
        nativeName: 'Bahasa Indonesia',
        openai: 'id',
        gemini: 'id-ID',
        whisper: 'id',
        llmContext: 'Please respond in Indonesian.',
        rtl: false
    },
    'ms': {
        name: 'Malay',
        nativeName: 'Bahasa Melayu',
        openai: 'ms',
        gemini: 'ms-MY',
        whisper: 'ms',
        llmContext: 'Please respond in Malay.',
        rtl: false
    },
    'tl': {
        name: 'Filipino',
        nativeName: 'Filipino',
        openai: 'tl',
        gemini: 'tl-PH',
        whisper: 'tl',
        llmContext: 'Please respond in Filipino.',
        rtl: false
    }
};

// Default language
const DEFAULT_LANGUAGE = 'en';

// Get language configuration for a specific provider
function getLanguageForProvider(languageCode, provider) {
    const language = LANGUAGES[languageCode];
    if (!language) {
        console.warn(`[Languages] Unknown language code: ${languageCode}, falling back to English`);
        return LANGUAGES[DEFAULT_LANGUAGE][provider] || DEFAULT_LANGUAGE;
    }
    
    return language[provider] || language.openai || languageCode;
}

// Get display name for a language
function getLanguageDisplayName(languageCode) {
    const language = LANGUAGES[languageCode];
    return language ? language.name : languageCode;
}

// Get native name for a language
function getLanguageNativeName(languageCode) {
    const language = LANGUAGES[languageCode];
    return language ? language.nativeName : languageCode;
}

// Get LLM context instruction for a language
function getLanguageLLMContext(languageCode) {
    const language = LANGUAGES[languageCode];
    return language ? language.llmContext : LANGUAGES[DEFAULT_LANGUAGE].llmContext;
}

// Check if language is RTL
function isRTL(languageCode) {
    const language = LANGUAGES[languageCode];
    return language ? language.rtl : false;
}

// Get all available languages as array
function getAvailableLanguages() {
    return Object.keys(LANGUAGES).map(code => ({
        code,
        name: LANGUAGES[code].name,
        nativeName: LANGUAGES[code].nativeName,
        rtl: LANGUAGES[code].rtl
    }));
}

// Get popular languages (most commonly used)
function getPopularLanguages() {
    const popularCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
    return popularCodes.map(code => ({
        code,
        name: LANGUAGES[code].name,
        nativeName: LANGUAGES[code].nativeName,
        rtl: LANGUAGES[code].rtl
    }));
}

// Validate language code
function isValidLanguageCode(languageCode) {
    return languageCode in LANGUAGES;
}

// Get language code from various formats (e.g., 'en-US' -> 'en')
function normalizeLanguageCode(languageCode) {
    if (!languageCode) return DEFAULT_LANGUAGE;
    
    // Handle exact matches first
    if (languageCode in LANGUAGES) {
        return languageCode;
    }
    
    // Handle language-region codes (e.g., 'en-US' -> 'en')
    const baseCode = languageCode.split('-')[0];
    if (baseCode in LANGUAGES) {
        return baseCode;
    }
    
    // Handle special cases
    if (languageCode.startsWith('zh-TW') || languageCode.startsWith('zh-Hant')) {
        return 'zh-TW';
    }
    
    console.warn(`[Languages] Could not normalize language code: ${languageCode}, falling back to ${DEFAULT_LANGUAGE}`);
    return DEFAULT_LANGUAGE;
}

module.exports = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    getLanguageForProvider,
    getLanguageDisplayName,
    getLanguageNativeName,
    getLanguageLLMContext,
    isRTL,
    getAvailableLanguages,
    getPopularLanguages,
    isValidLanguageCode,
    normalizeLanguageCode
}; 