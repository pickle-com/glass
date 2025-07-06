const sqliteClient = require('../../../../common/services/sqliteClient');

function addTranscript({ sessionId, speaker, text }) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const transcriptId = require('crypto').randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const query = `INSERT INTO transcripts (id, session_id, start_at, speaker, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(query, [transcriptId, sessionId, now, speaker, text, now], function(err) {
            if (err) {
                console.error('Error adding transcript:', err);
                reject(err);
            } else {
                resolve({ id: transcriptId });
            }
        });
    });
}

function getAllTranscriptsBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = "SELECT * FROM transcripts WHERE session_id = ? ORDER BY start_at ASC";
        db.all(query, [sessionId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    addTranscript,
    getAllTranscriptsBySessionId,
}; 