const sqliteClient = require('../../common/services/sqliteClient');

class SearchRepository {
    constructor() {
        this.db = null;
    }

    initialize() {
        this.db = sqliteClient.getDb();
    }

    searchContent(query, uid, options = {}) {
        if (!this.db) {
            this.initialize();
        }

        const {
            limit = 50,
            includeTranscripts = true,
            includeAiMessages = true,
            sessionType = null
        } = options;

        if (!query || query.trim().length === 0) {
            return [];
        }

        const searchTerm = `%${query.toLowerCase()}%`;
        const results = [];

        // Search in AI messages
        if (includeAiMessages) {
            const aiMessageQuery = `
                SELECT 
                    am.id,
                    am.session_id,
                    am.content,
                    am.role,
                    am.sent_at as timestamp,
                    am.model,
                    s.title as session_title,
                    s.session_type,
                    s.started_at as session_started_at,
                    'ai_message' as content_type,
                    CASE 
                        WHEN LOWER(am.content) LIKE ? THEN 10
                        ELSE 5
                    END as match_score
                FROM ai_messages am
                JOIN sessions s ON am.session_id = s.id
                WHERE s.uid = ? 
                    AND LOWER(am.content) LIKE ?
                    ${sessionType ? 'AND s.session_type = ?' : ''}
                ORDER BY match_score DESC, am.sent_at DESC
                LIMIT ?
            `;

            const aiParams = sessionType 
                ? [searchTerm, uid, searchTerm, sessionType, limit]
                : [searchTerm, uid, searchTerm, limit];

            const aiResults = this.db.prepare(aiMessageQuery).all(...aiParams);
            results.push(...aiResults);
        }

        // Search in transcripts
        if (includeTranscripts) {
            const transcriptQuery = `
                SELECT 
                    t.id,
                    t.session_id,
                    t.text as content,
                    t.speaker as role,
                    t.start_at as timestamp,
                    t.lang,
                    s.title as session_title,
                    s.session_type,
                    s.started_at as session_started_at,
                    'transcript' as content_type,
                    CASE 
                        WHEN LOWER(t.text) LIKE ? THEN 10
                        ELSE 5
                    END as match_score
                FROM transcripts t
                JOIN sessions s ON t.session_id = s.id
                WHERE s.uid = ? 
                    AND LOWER(t.text) LIKE ?
                    ${sessionType ? 'AND s.session_type = ?' : ''}
                ORDER BY match_score DESC, t.start_at DESC
                LIMIT ?
            `;

            const transcriptParams = sessionType 
                ? [searchTerm, uid, searchTerm, sessionType, limit]
                : [searchTerm, uid, searchTerm, limit];

            const transcriptResults = this.db.prepare(transcriptQuery).all(...transcriptParams);
            results.push(...transcriptResults);
        }

        // Sort all results by match score and timestamp
        return results
            .sort((a, b) => {
                if (a.match_score !== b.match_score) {
                    return b.match_score - a.match_score;
                }
                return b.timestamp - a.timestamp;
            })
            .slice(0, limit);
    }

    searchSessions(query, uid, options = {}) {
        if (!this.db) {
            this.initialize();
        }

        const { limit = 20 } = options;

        if (!query || query.trim().length === 0) {
            return [];
        }

        const searchTerm = `%${query.toLowerCase()}%`;

        // Search sessions and get match counts
        const sessionQuery = `
            SELECT 
                s.id,
                s.title,
                s.session_type,
                s.started_at,
                s.ended_at,
                s.updated_at,
                COALESCE(am_counts.message_matches, 0) as message_matches,
                COALESCE(t_counts.transcript_matches, 0) as transcript_matches,
                CASE 
                    WHEN LOWER(s.title) LIKE ? THEN 'title'
                    ELSE 'content'
                END as match_type
            FROM sessions s
            LEFT JOIN (
                SELECT session_id, COUNT(*) as message_matches
                FROM ai_messages 
                WHERE LOWER(content) LIKE ?
                GROUP BY session_id
            ) am_counts ON s.id = am_counts.session_id
            LEFT JOIN (
                SELECT session_id, COUNT(*) as transcript_matches
                FROM transcripts 
                WHERE LOWER(text) LIKE ?
                GROUP BY session_id
            ) t_counts ON s.id = t_counts.session_id
            WHERE s.uid = ? 
                AND (
                    LOWER(s.title) LIKE ? 
                    OR am_counts.message_matches > 0
                    OR t_counts.transcript_matches > 0
                )
            ORDER BY 
                CASE WHEN LOWER(s.title) LIKE ? THEN 1 ELSE 2 END,
                (COALESCE(am_counts.message_matches, 0) + COALESCE(t_counts.transcript_matches, 0)) DESC,
                s.updated_at DESC
            LIMIT ?
        `;

        return this.db.prepare(sessionQuery).all(
            searchTerm, searchTerm, searchTerm, uid, searchTerm, searchTerm, limit
        );
    }

    getSessionPreviews(sessionId, query, maxPreviews = 3) {
        if (!this.db) {
            this.initialize();
        }

        const searchTerm = `%${query.toLowerCase()}%`;
        const previews = [];

        // Get AI message previews
        const aiPreviewQuery = `
            SELECT content, role, sent_at as timestamp, 'ai_message' as type
            FROM ai_messages 
            WHERE session_id = ? AND LOWER(content) LIKE ?
            ORDER BY sent_at DESC
            LIMIT ?
        `;

        const aiPreviews = this.db.prepare(aiPreviewQuery).all(sessionId, searchTerm, maxPreviews);
        previews.push(...aiPreviews);

        // Get transcript previews
        const transcriptPreviewQuery = `
            SELECT text as content, speaker as role, start_at as timestamp, 'transcript' as type
            FROM transcripts 
            WHERE session_id = ? AND LOWER(text) LIKE ?
            ORDER BY start_at DESC
            LIMIT ?
        `;

        const transcriptPreviews = this.db.prepare(transcriptPreviewQuery).all(sessionId, searchTerm, maxPreviews);
        previews.push(...transcriptPreviews);

        // Sort and limit previews
        return previews
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, maxPreviews);
    }

    getMessageContext(messageId, messageType, contextSize = 5) {
        if (!this.db) {
            this.initialize();
        }

        let targetMessage;
        let sessionId;

        if (messageType === 'ai_message') {
            targetMessage = this.db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(messageId);
            sessionId = targetMessage?.session_id;
        } else if (messageType === 'transcript') {
            targetMessage = this.db.prepare('SELECT * FROM transcripts WHERE id = ?').get(messageId);
            sessionId = targetMessage?.session_id;
        }

        if (!targetMessage || !sessionId) {
            return null;
        }

        // Get surrounding context
        const contextQuery = `
            SELECT * FROM (
                SELECT id, content, role, sent_at as timestamp, 'ai_message' as type
                FROM ai_messages 
                WHERE session_id = ?
                UNION ALL
                SELECT id, text as content, speaker as role, start_at as timestamp, 'transcript' as type
                FROM transcripts 
                WHERE session_id = ?
            )
            ORDER BY timestamp
        `;

        const allMessages = this.db.prepare(contextQuery).all(sessionId, sessionId);
        const targetIndex = allMessages.findIndex(msg => msg.id === messageId);

        if (targetIndex === -1) {
            return { target: targetMessage, context: [] };
        }

        const start = Math.max(0, targetIndex - contextSize);
        const end = Math.min(allMessages.length, targetIndex + contextSize + 1);
        const context = allMessages.slice(start, end);

        return {
            target: targetMessage,
            context,
            session_id: sessionId
        };
    }
}

module.exports = new SearchRepository();
