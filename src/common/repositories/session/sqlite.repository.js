const sqliteClient = require('../../services/sqliteClient');

function getById(id) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM sessions WHERE id = ?', [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function create(uid, type = 'ask') {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const sessionId = require('crypto').randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const query = `INSERT INTO sessions (id, uid, title, session_type, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.run(query, [sessionId, uid, `Session @ ${new Date().toLocaleTimeString()}`, type, now, now], function(err) {
            if (err) {
                console.error('SQLite: Failed to create session:', err);
                reject(err);
            } else {
                console.log(`SQLite: Created session ${sessionId} for user ${uid} (type: ${type})`);
                resolve(sessionId);
            }
        });
    });
}

function getAllByUserId(uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = "SELECT id, uid, title, session_type, started_at, ended_at, sync_state, updated_at FROM sessions WHERE uid = ? ORDER BY started_at DESC";
        db.all(query, [uid], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function updateTitle(id, title) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.run('UPDATE sessions SET title = ? WHERE id = ?', [title, id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function deleteWithRelatedData(id) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION;");
            const queries = [
                "DELETE FROM transcripts WHERE session_id = ?",
                "DELETE FROM ai_messages WHERE session_id = ?",
                "DELETE FROM summaries WHERE session_id = ?",
                "DELETE FROM sessions WHERE id = ?"
            ];
            queries.forEach(query => {
                db.run(query, [id], (err) => {
                    if (err) {
                        db.run("ROLLBACK;");
                        return reject(err);
                    }
                });
            });
            db.run("COMMIT;", (err) => {
                if (err) {
                    db.run("ROLLBACK;");
                    return reject(err);
                }
                resolve({ success: true });
            });
        });
    });
}

function end(id) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const query = `UPDATE sessions SET ended_at = ?, updated_at = ? WHERE id = ?`;
        db.run(query, [now, now, id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

function updateType(id, type) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const query = 'UPDATE sessions SET session_type = ?, updated_at = ? WHERE id = ?';
        db.run(query, [type, now, id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function touch(id) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const query = 'UPDATE sessions SET updated_at = ? WHERE id = ?';
        db.run(query, [now, id], function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}

async function getOrCreateActive(uid, requestedType = 'ask') {
    const db = sqliteClient.getDb();
    
    // 1. Look for ANY active session for the user (ended_at IS NULL).
    //    Prefer 'listen' sessions over 'ask' sessions to ensure continuity.
    const findQuery = `
        SELECT id, session_type FROM sessions 
        WHERE uid = ? AND ended_at IS NULL
        ORDER BY CASE session_type WHEN 'listen' THEN 1 WHEN 'ask' THEN 2 ELSE 3 END
        LIMIT 1
    `;

    const activeSession = await new Promise((resolve, reject) => {
        db.get(findQuery, [uid], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (activeSession) {
        // An active session exists.
        console.log(`[Repo] Found active session ${activeSession.id} of type ${activeSession.session_type}`);
        
        // 2. Promotion Logic: If it's an 'ask' session and we need 'listen', promote it.
        if (activeSession.session_type === 'ask' && requestedType === 'listen') {
            await updateType(activeSession.id, 'listen');
            console.log(`[Repo] Promoted session ${activeSession.id} to 'listen' type.`);
        }

        // 3. Touch the session and return its ID.
        await touch(activeSession.id);
        return activeSession.id;
    } else {
        // 4. No active session found, create a new one.
        console.log(`[Repo] No active session for user ${uid}. Creating new '${requestedType}' session.`);
        return create(uid, requestedType);
    }
}

function endAllActiveSessions() {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const query = `UPDATE sessions SET ended_at = ?, updated_at = ? WHERE ended_at IS NULL`;
        db.run(query, [now, now], function(err) {
            if (err) {
                console.error('SQLite: Failed to end all active sessions:', err);
                reject(err);
            } else {
                console.log(`[Repo] Ended ${this.changes} active session(s).`);
                resolve({ changes: this.changes });
            }
        });
    });
}

module.exports = {
    getById,
    create,
    getAllByUserId,
    updateTitle,
    deleteWithRelatedData,
    end,
    updateType,
    touch,
    getOrCreateActive,
    endAllActiveSessions,
}; 