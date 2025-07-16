const sqliteClient = require('../../../common/services/sqliteClient');

function saveSummary({ uid, sessionId, tldr, text, bullet_json, action_json, model = 'unknown' }) {
    // uid is ignored in the SQLite implementation
    return new Promise((resolve, reject) => {
        try {
            const db = sqliteClient.getDb();
            const now = Math.floor(Date.now() / 1000);
            const query = `
                INSERT INTO summaries (session_id, generated_at, model, text, tldr, bullet_json, action_json, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    generated_at=excluded.generated_at,
                    model=excluded.model,
                    text=excluded.text,
                    tldr=excluded.tldr,
                    bullet_json=excluded.bullet_json,
                    action_json=excluded.action_json,
                    updated_at=excluded.updated_at
            `;
            
            const result = db.prepare(query).run(sessionId, now, model, text, tldr, bullet_json, action_json, now);
            resolve({ changes: result.changes });
        } catch (err) {
            console.error('Error saving summary:', err);
            reject(err);
        }
    });
}

function getSummaryBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = "SELECT * FROM summaries WHERE session_id = ?";
    return db.prepare(query).get(sessionId) || null;
}

module.exports = {
    saveSummary,
    getSummaryBySessionId,
}; 