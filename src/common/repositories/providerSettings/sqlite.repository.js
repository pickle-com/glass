const sqliteClient = require('../../services/sqliteClient');

function getByProvider(uid, provider) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT * FROM provider_settings WHERE uid = ? AND provider = ?');
    return stmt.get(uid, provider) || null;
}

function getAllByUid(uid) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT * FROM provider_settings WHERE uid = ? ORDER BY provider');
    return stmt.all(uid);
}

function upsert(uid, provider, settings) {
    const db = sqliteClient.getDb();
    
    // Use SQLite's UPSERT syntax (INSERT ... ON CONFLICT ... DO UPDATE)
    const stmt = db.prepare(`
        INSERT INTO provider_settings (uid, provider, api_key, selected_llm_model, selected_stt_model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid, provider) DO UPDATE SET
            api_key = excluded.api_key,
            selected_llm_model = excluded.selected_llm_model,
            selected_stt_model = excluded.selected_stt_model,
            updated_at = excluded.updated_at
    `);
    
    const result = stmt.run(
        uid,
        provider,
        settings.api_key || null,
        settings.selected_llm_model || null,
        settings.selected_stt_model || null,
        settings.created_at || Date.now(),
        settings.updated_at
    );
    
    return { changes: result.changes };
}

function remove(uid, provider) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('DELETE FROM provider_settings WHERE uid = ? AND provider = ?');
    const result = stmt.run(uid, provider);
    return { changes: result.changes };
}

function removeAllByUid(uid) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('DELETE FROM provider_settings WHERE uid = ?');
    const result = stmt.run(uid);
    return { changes: result.changes };
}

module.exports = {
    getByProvider,
    getAllByUid,
    upsert,
    remove,
    removeAllByUid
}; 