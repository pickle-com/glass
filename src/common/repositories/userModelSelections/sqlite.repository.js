const sqliteClient = require('../../services/sqliteClient');

function get(uid) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT * FROM user_model_selections WHERE uid = ?');
    return stmt.get(uid) || null;
}

function upsert(uid, selections) {
    const db = sqliteClient.getDb();
    
    // Use SQLite's UPSERT syntax (INSERT ... ON CONFLICT ... DO UPDATE)
    const stmt = db.prepare(`
        INSERT INTO user_model_selections (uid, selected_llm_provider, selected_llm_model, 
                                         selected_stt_provider, selected_stt_model, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
            selected_llm_provider = excluded.selected_llm_provider,
            selected_llm_model = excluded.selected_llm_model,
            selected_stt_provider = excluded.selected_stt_provider,
            selected_stt_model = excluded.selected_stt_model,
            updated_at = excluded.updated_at
    `);
    
    const result = stmt.run(
        uid,
        selections.selected_llm_provider || null,
        selections.selected_llm_model || null,
        selections.selected_stt_provider || null,
        selections.selected_stt_model || null,
        selections.updated_at
    );
    
    return { changes: result.changes };
}

function remove(uid) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('DELETE FROM user_model_selections WHERE uid = ?');
    const result = stmt.run(uid);
    return { changes: result.changes };
}

module.exports = {
    get,
    upsert,
    remove
}; 