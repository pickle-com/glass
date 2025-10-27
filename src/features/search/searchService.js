const searchRepository = require('./repositories/sqlite.repository');

class SearchService {
    async searchContent(query, uid, options = {}) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const results = searchRepository.searchContent(query, uid, options);
        return results.map(result => this.enhanceSearchResult(result, query));
    }

    async searchSessions(query, uid, options = {}) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const sessions = searchRepository.searchSessions(query, uid, options);
        
        return sessions.map(session => {
            const previews = searchRepository.getSessionPreviews(session.id, query, 2);
            return {
                ...session,
                total_matches: session.message_matches + session.transcript_matches,
                previews: previews.map(preview => ({
                    ...preview,
                    snippet: this.createPreviewSnippet(preview.content, query)
                }))
            };
        });
    }

    async search(query, uid, options = {}) {
        if (!query || query.trim().length === 0) {
            return {
                sessions: [],
                content: [],
                total_results: 0
            };
        }

        const [sessions, content] = await Promise.all([
            this.searchSessions(query, uid, { limit: options.sessionLimit || 10 }),
            this.searchContent(query, uid, { limit: options.contentLimit || 20 })
        ]);

        return {
            sessions,
            content,
            total_results: sessions.length + content.length,
            query: query.trim()
        };
    }

    async getMessageContext(messageId, messageType, contextSize = 5) {
        return searchRepository.getMessageContext(messageId, messageType, contextSize);
    }

    enhanceSearchResult(result, query) {
        const snippet = this.createPreviewSnippet(result.content, query);
        const highlightedSnippet = this.highlightKeywords(snippet, query);
        
        return {
            ...result,
            snippet,
            highlighted_snippet: highlightedSnippet,
            formatted_timestamp: new Date(result.timestamp * 1000).toISOString(),
            session_formatted_timestamp: new Date(result.session_started_at * 1000).toISOString(),
            display_role: this.formatRole(result.role, result.content_type)
        };
    }

    createPreviewSnippet(content, query, maxLength = 150) {
        if (!content || !query) {
            return content ? content.substring(0, maxLength) + (content.length > maxLength ? '...' : '') : '';
        }

        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        
        const index = contentLower.indexOf(queryLower);
        if (index === -1) {
            return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
        }

        const contextBefore = 60;
        const contextAfter = maxLength - query.length - contextBefore;
        
        const start = Math.max(0, index - contextBefore);
        const end = Math.min(content.length, index + query.length + contextAfter);
        
        let snippet = content.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet;
    }

    highlightKeywords(text, query) {
        if (!text || !query) return text;

        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    formatRole(role, contentType) {
        if (contentType === 'ai_message') {
            return role === 'user' ? 'You' : 'AI Assistant';
        } else if (contentType === 'transcript') {
            return role ? `${role} (Transcript)` : 'Transcript';
        }
        return role || 'Unknown';
    }

    async getSearchSuggestions(uid, limit = 5) {
        return [
            'meeting notes',
            'action items',
            'decisions made',
            'follow up',
            'questions asked'
        ].slice(0, limit);
    }

    async getSearchStats(uid) {
        const db = searchRepository.db || searchRepository.initialize() || searchRepository.db;
        
        const stats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM sessions WHERE uid = ?) as total_sessions,
                (SELECT COUNT(*) FROM ai_messages am JOIN sessions s ON am.session_id = s.id WHERE s.uid = ?) as total_messages,
                (SELECT COUNT(*) FROM transcripts t JOIN sessions s ON t.session_id = s.id WHERE s.uid = ?) as total_transcripts,
                (SELECT COUNT(*) FROM sessions WHERE uid = ? AND session_type = 'ask') as ask_sessions,
                (SELECT COUNT(*) FROM sessions WHERE uid = ? AND session_type = 'listen') as listen_sessions
        `).get(uid, uid, uid, uid, uid);

        return {
            ...stats,
            total_searchable_content: stats.total_messages + stats.total_transcripts
        };
    }
}

module.exports = new SearchService();
