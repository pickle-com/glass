const sqliteClient = require('../../../../common/services/sqliteClient');

function saveSummary({ sessionId, tldr, text, bullet_json, action_json, model = 'gpt-4.1' }) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
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
        db.run(query, [sessionId, now, model, text, tldr, bullet_json, action_json, now], function(err) {
            if (err) {
                console.error('Error saving summary:', err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function getSummaryBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM summaries WHERE session_id = ?";
        db.get(query, [sessionId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

module.exports = {
    saveSummary,
    getSummaryBySessionId,
}; 