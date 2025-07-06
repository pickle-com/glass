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
    
    return new Promise((resolve, reject) => {
        db.run(query, [uid, displayName, email, now], (err) => {
            if (err) {
                console.error('SQLite: Failed to find or create user:', err);
                return reject(err);
            }
            getById(uid).then(resolve).catch(reject);
        });
    });
}

function getById(uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE uid = ?', [uid], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function saveApiKey(apiKey, uid, provider = 'openai') {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET api_key = ?, provider = ? WHERE uid = ?',
            [apiKey, provider, uid],
            function(err) {
                if (err) {
                    console.error('SQLite: Failed to save API key:', err);
                    reject(err);
                } else {
                    console.log(`SQLite: API key saved for user ${uid} with provider ${provider}.`);
                    resolve({ changes: this.changes });
                }
            }
        );
    });
}

function update({ uid, displayName }) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET display_name = ? WHERE uid = ?', [displayName, uid], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function deleteById(uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const userSessions = db.prepare('SELECT id FROM sessions WHERE uid = ?').all(uid);
        const sessionIds = userSessions.map(s => s.id);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION;");
            
            try {
                if (sessionIds.length > 0) {
                    const placeholders = sessionIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM transcripts WHERE session_id IN (${placeholders})`).run(...sessionIds);
                    db.prepare(`DELETE FROM ai_messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
                    db.prepare(`DELETE FROM summaries WHERE session_id IN (${placeholders})`).run(...sessionIds);
                    db.prepare(`DELETE FROM sessions WHERE uid = ?`).run(uid);
                }
                db.prepare('DELETE FROM prompt_presets WHERE uid = ? AND is_default = 0').run(uid);
                db.prepare('DELETE FROM users WHERE uid = ?').run(uid);

                db.run("COMMIT;", (err) => {
                    if (err) {
                        db.run("ROLLBACK;");
                        return reject(err);
                    }
                    resolve({ success: true });
                });
            } catch (err) {
                db.run("ROLLBACK;");
                reject(err);
            }
        });
    });
}

module.exports = {
    findOrCreate,
    getById,
    saveApiKey,
    update,
    deleteById
}; 