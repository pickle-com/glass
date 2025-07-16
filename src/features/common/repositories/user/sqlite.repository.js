const sqliteClient = require('../../services/sqliteClient');

function findOrCreate(user) {
    const db = sqliteClient.getDb();
    
    if (!user || !user.uid) {
        throw new Error('User object and uid are required');
    }
    
    const { uid, displayName, email } = user;
    const now = Math.floor(Date.now() / 1000);
    
    // Validate inputs
    const safeDisplayName = displayName || 'User';
    const safeEmail = email || 'no-email@example.com';

    const query = `
        INSERT INTO users (uid, display_name, email, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET 
            display_name=excluded.display_name, 
            email=excluded.email
    `;
    
    try {
        console.log('[SQLite] Creating/updating user:', { uid, displayName: safeDisplayName, email: safeEmail });
        db.prepare(query).run(uid, safeDisplayName, safeEmail, now);
        const result = getById(uid);
        console.log('[SQLite] User operation successful:', result);
        return result;
    } catch (err) {
        console.error('SQLite: Failed to find or create user:', err);
        console.error('SQLite: User data:', { uid, displayName: safeDisplayName, email: safeEmail });
        throw new Error(`Failed to create user in database: ${err.message}`);
    }
}

function getById(uid) {
    const db = sqliteClient.getDb();
    return db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
}



function update({ uid, displayName }) {
    const db = sqliteClient.getDb();
    const result = db.prepare('UPDATE users SET display_name = ? WHERE uid = ?').run(displayName, uid);
    return { changes: result.changes };
}

function setMigrationComplete(uid) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('UPDATE users SET has_migrated_to_firebase = 1 WHERE uid = ?');
    const result = stmt.run(uid);
    if (result.changes > 0) {
        console.log(`[Repo] Marked migration as complete for user ${uid}.`);
    }
    return result;
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
    update,
    setMigrationComplete,
    deleteById
}; 