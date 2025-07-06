const sqliteClient = require('../../../common/services/sqliteClient');

function addAiMessage({ sessionId, role, content, model = 'gpt-4.1' }) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const messageId = require('crypto').randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const query = `INSERT INTO ai_messages (id, session_id, sent_at, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [messageId, sessionId, now, role, content, model, now], function(err) {
            if (err) {
                console.error('SQLite: Failed to add AI message:', err);
                reject(err);
            }
            else {
                resolve({ id: messageId });
            }
        });
    });
}

function getAllAiMessagesBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM ai_messages WHERE session_id = ? ORDER BY sent_at ASC";
        db.all(query, [sessionId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    addAiMessage,
    getAllAiMessagesBySessionId
}; 