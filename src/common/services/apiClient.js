const axios = require('axios');
const config = require('../config/config');

class APIClient {
    constructor() {
        this.baseURL = config.get('apiUrl');
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: config.get('apiTimeout'),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('API request failed:', error.message);
                if (error.response) {
                    console.error('response status:', error.response.status);
                    console.error('response data:', error.response.data);
                }
                return Promise.reject(error);
            }
        );
    }

    async initialize() {
        try {
            const response = await this.client.get('/api/auth/status');
            console.log('[APIClient] checked default user status:', response.data);
            return true;
        } catch (error) {
            console.error('[APIClient] failed to initialize:', error);
            return false;
        }
    }

    async checkConnection() {
        try {
            const response = await this.client.get('/');
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async saveApiKey(apiKey) {
        try {
            const response = await this.client.post('/api/user/api-key', { apiKey });
            return response.data;
        } catch (error) {
            console.error('failed to save api key:', error);
            throw error;
        }
    }

    async checkApiKey() {
        try {
            const response = await this.client.get('/api/user/api-key');
            return response.data;
        } catch (error) {
            console.error('failed to check api key:', error);
            return { hasApiKey: false };
        }
    }

    async getUserBatchData(includes = ['profile', 'context', 'presets']) {
        try {
            const includeParam = includes.join(',');
            const response = await this.client.get(`/api/user/batch?include=${includeParam}`);
            return response.data;
        } catch (error) {
            console.error('failed to get user batch data:', error);
            return null;
        }
    }

    async getUserContext() {
        try {
            const response = await this.client.get('/api/user/context');
            return response.data.context;
        } catch (error) {
            console.error('fail to get user context:', error);
            return null;
        }
    }

    async getUserProfile() {
        try {
            const response = await this.client.get('/api/user/profile');
            return response.data;
        } catch (error) {
            console.error('failed to get user profile:', error);
            return null;
        }
    }

    async getUserPresets() {
        try {
            const response = await this.client.get('/api/user/presets');
            return response.data;
        } catch (error) {
            console.error('failed to get user presets:', error);
            return [];
        }
    }

    async updateUserContext(context) {
        try {
            const response = await this.client.post('/api/user/context', context);
            return response.data;
        } catch (error) {
            console.error('failed to update user context:', error);
            throw error;
        }
    }

    async addActivity(activity) {
        try {
            const response = await this.client.post('/api/user/activities', activity);
            return response.data;
        } catch (error) {
            console.error('failed to add activity:', error);
            throw error;
        }
    }

    async getPresetTemplates() {
        try {
            const response = await this.client.get('/api/preset-templates');
            return response.data;
        } catch (error) {
            console.error('failed to get preset templates:', error);
            return [];
        }
    }

    async updateUserProfile(profile) {
        try {
            const response = await this.client.post('/api/user/profile', profile);
            return response.data;
        } catch (error) {
            console.error('failed to update user profile:', error);
            throw error;
        }
    }

    async searchUsers(name = '') {
        try {
            const response = await this.client.get('/api/users/search', {
                params: { name }
            });
            return response.data;
        } catch (error) {
            console.error('failed to search users:', error);
            return [];
        }
    }

    async getUserProfileById(userId) {
        try {
            const response = await this.client.get(`/api/users/${userId}/profile`);
            return response.data;
        } catch (error) {
            console.error('failed to get user profile by id:', error);
            return null;
        }
    }

    async saveConversationSession(sessionId, conversationHistory) {
        try {
            const payload = {
                sessionId,
                conversationHistory
            };
            const response = await this.client.post('/api/conversations', payload);
            return response.data;
        } catch (error) {
            console.error('failed to save conversation session:', error);
            throw error;
        }
    }

    async getConversationSession(sessionId) {
        try {
            const response = await this.client.get(`/api/conversations/${sessionId}`);
            return response.data;
        } catch (error) {
            console.error('failed to get conversation session:', error);
            return null;
        }
    }

    async getAllConversationSessions() {
        try {
            const response = await this.client.get('/api/conversations');
            return response.data;
        } catch (error) {
            console.error('failed to get all conversation sessions:', error);
            return [];
        }
    }

    async deleteConversationSession(sessionId) {
        try {
            const response = await this.client.delete(`/api/conversations/${sessionId}`);
            return response.data;
        } catch (error) {
            console.error('failed to delete conversation session:', error);
            throw error;
        }
    }

    async getSyncStatus() {
        try {
            const response = await this.client.get('/api/sync/status');
            return response.data;
        } catch (error) {
            console.error('failed to get sync status:', error);
            return null;
        }
    }

    async getFullUserData() {
        try {
            const response = await this.client.get('/api/user/full');
            return response.data;
        } catch (error) {
            console.error('failed to get full user data:', error);
            return null;
        }
    }
}

const apiClient = new APIClient();

module.exports = apiClient; 
module.exports = apiClient; 