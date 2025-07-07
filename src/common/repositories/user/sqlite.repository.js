const sqliteClient = require('../../services/sqliteClient');

function findOrCreate(user) {
    const db = sqliteClient.getDb();
    const { uid, displayName, email } = user;
    const now = Math.floor(Date.now() / 1000);

    const query = `
        INSERT INTO users (uid, display_name, email, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET 
            display_name=excluded.display_name, 
            email=excluded.email
    `;
    
    try {
        db.prepare(query).run(uid, displayName, email, now);
        return getById(uid);
    } catch (err) {
        console.error('SQLite: Failed to find or create user:', err);
        throw err;
    }
}

function getById(uid) {
    const db = sqliteClient.getDb();
    return db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
}

function saveApiKey(apiKey, uid, provider = 'openai') {
    const db = sqliteClient.getDb();
    try {
        const result = db.prepare('UPDATE users SET api_key = ?, provider = ? WHERE uid = ?').run(apiKey, provider, uid);
        console.log(`SQLite: API key saved for user ${uid} with provider ${provider}.`);
        return { changes: result.changes };
    } catch (err) {
        console.error('SQLite: Failed to save API key:', err);
        throw err;
    }
}

function update({ uid, displayName }) {
    const db = sqliteClient.getDb();
    const result = db.prepare('UPDATE users SET display_name = ? WHERE uid = ?').run(displayName, uid);
    return { changes: result.changes };
}

function deleteById(uid) {
    const db = sqliteClient.getDb();
    const userSessions = db.prepare('SELECT id FROM sessions WHERE uid = ?').all(uid);
    const sessionIds = userSessions.map(s => s.id);

    const transaction = db.transaction(() => {
        if (sessionIds.length > 0) {
            const placeholders = sessionIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM transcripts WHERE session_id IN (${placeholders})`).run(...sessionIds);
            db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
            db.prepare(`DELETE FROM summaries WHERE session_id IN (${placeholders})`).run(...sessionIds);
            db.prepare(`DELETE FROM sessions WHERE uid = ?`).run(uid);
        }
        db.prepare('DELETE FROM prompt_presets WHERE uid = ? AND is_default = 0').run(uid);
        db.prepare('DELETE FROM users WHERE uid = ?').run(uid);
    });

    try {
        transaction();
        return { success: true };
    } catch (err) {
        throw err;
    }
}

module.exports = {
    findOrCreate,
    getById,
    saveApiKey,
    update,
    deleteById
}; 