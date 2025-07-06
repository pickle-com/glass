const config = require('../config/config');

class DataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = config.get('cacheTimeout');
        this.enableCaching = config.get('enableCaching');
        this.sqliteClient = null;
        this.currentUserId = 'default_user';
        this.isInitialized = false;

        if (config.get('enableSQLiteStorage')) {
            try {
                this.sqliteClient = require('./sqliteClient');
                console.log('[DataService] SQLite storage enabled.');
            } catch (error) {
                console.error('[DataService] Failed to load SQLite client:', error);
            }
        }
    }

    async initialize() {
        if (this.isInitialized || !this.sqliteClient) {
            return;
        }
        
        try {
            await this.sqliteClient.connect();
            this.isInitialized = true;
            console.log('[DataService] Initialized successfully');
        } catch (error) {
            console.error('[DataService] Failed to initialize:', error);
            throw error;
        }
    }

    setCurrentUser(uid) {
        if (this.currentUserId !== uid) {
            console.log(`[DataService] Current user switched to: ${uid}`);
            this.currentUserId = uid;
            this.clearCache();
        }
    }

    getCacheKey(operation, params = '') {
        return `${this.currentUserId}:${operation}:${params}`;
    }

    getFromCache(key) {
        if (!this.enableCaching) return null;
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        if (!this.enableCaching) return;
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache() {
        this.cache.clear();
    }

    async findOrCreateUser(firebaseUser) {
        if (!this.sqliteClient) {
            console.log('[DataService] SQLite client not available, skipping user creation');
            return firebaseUser;
        }
        
        try {
            await this.initialize();
            const existingUser = await this.sqliteClient.getUser(firebaseUser.uid);
            
            if (!existingUser) {
                console.log(`[DataService] Creating new user in local DB: ${firebaseUser.uid}`);
                await this.sqliteClient.findOrCreateUser({
                    uid: firebaseUser.uid,
                    display_name: firebaseUser.displayName || firebaseUser.display_name,
                    email: firebaseUser.email
                });
            }
            
            this.clearCache();
            return firebaseUser;
        } catch (error) {
            console.error('[DataService] Failed to sync Firebase user to local DB:', error);
            return firebaseUser;
        }
    }

    async saveApiKey(apiKey) {
        if (!this.sqliteClient) {
            throw new Error("SQLite client not available.");
        }
        try {
            await this.initialize();
            const result = await this.sqliteClient.saveApiKey(apiKey, this.currentUserId);
            this.clearCache();
            return result;
        } catch (error) {
            console.error('[DataService] Failed to save API key to SQLite:', error);
            throw error;
        }
    }

    async checkApiKey() {
        if (!this.sqliteClient) return { hasApiKey: false };
        try {
            await this.initialize();
            const user = await this.sqliteClient.getUser(this.currentUserId);
            return { hasApiKey: !!user?.api_key && user.api_key.length > 0 };
        } catch (error) {
            console.error('[DataService] Failed to check API key from SQLite:', error);
            return { hasApiKey: false };
        }
    }

    async getUserPresets() {
        const cacheKey = this.getCacheKey('presets');
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (!this.sqliteClient) return [];
        try {
            await this.initialize();
            const presets = await this.sqliteClient.getPresets(this.currentUserId);
            this.setCache(cacheKey, presets);
            return presets;
        } catch (error) {
            console.error('[DataService] Failed to get presets from SQLite:', error);
            return [];
        }
    }

    async getPresetTemplates() {
        const cacheKey = this.getCacheKey('preset_templates');
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (!this.sqliteClient) return [];
        try {
            await this.initialize();
            const templates = await this.sqliteClient.getPresetTemplates();
            this.setCache(cacheKey, templates);
            return templates;
        } catch (error) {
            console.error('[DataService] Failed to get preset templates from SQLite:', error);
            return [];
        }
    }
}

const dataService = new DataService();

module.exports = dataService;