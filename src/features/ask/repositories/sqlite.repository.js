const sqliteClient = require('../../common/services/sqliteClient');

function addAiMessage({ uid, sessionId, role, content, model = 'unknown' }) {
    // uid is ignored in the SQLite implementation
    const db = sqliteClient.getDb();
    const messageId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `INSERT INTO ai_messages (id, session_id, sent_at, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    try {
        db.prepare(query).run(messageId, sessionId, now, role, content, model, now);
        return { id: messageId };
    } catch (err) {
        console.error('SQLite: Failed to add AI message:', err);
        throw err;
    }
}

function getAllAiMessagesBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = "SELECT * FROM ai_messages WHERE session_id = ? ORDER BY sent_at ASC";
    return db.prepare(query).all(sessionId);
}

module.exports = {
    addAiMessage,
    getAllAiMessagesBySessionId
}; 