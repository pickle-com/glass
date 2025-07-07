const sqliteClient = require('../../../../common/services/sqliteClient');

function addTranscript({ sessionId, speaker, text }) {
    const db = sqliteClient.getDb();
    const transcriptId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `INSERT INTO transcripts (id, session_id, start_at, speaker, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
    
    try {
        db.prepare(query).run(transcriptId, sessionId, now, speaker, text, now);
        return { id: transcriptId };
    } catch (err) {
        console.error('Error adding transcript:', err);
        throw err;
    }
}

function getAllTranscriptsBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = "SELECT * FROM transcripts WHERE session_id = ? ORDER BY start_at ASC";
    return db.prepare(query).all(sessionId);
}

module.exports = {
    addTranscript,
    getAllTranscriptsBySessionId,
}; 