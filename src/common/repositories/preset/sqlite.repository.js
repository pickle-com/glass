const sqliteClient = require('../../services/sqliteClient');

function getPresets(uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM prompt_presets 
            WHERE uid = ? OR is_default = 1 
            ORDER BY is_default DESC, title ASC
        `;
        db.all(query, [uid], (err, rows) => {
            if (err) {
                console.error('SQLite: Failed to get presets:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function getPresetTemplates() {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM prompt_presets 
            WHERE is_default = 1 
            ORDER BY title ASC
        `;
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('SQLite: Failed to get preset templates:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function create({ uid, title, prompt }) {
    const db = sqliteClient.getDb();
    const presetId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `INSERT INTO prompt_presets (id, uid, title, prompt, is_default, created_at, sync_state) VALUES (?, ?, ?, ?, 0, ?, 'dirty')`;
    
    return new Promise((resolve, reject) => {
        db.run(query, [presetId, uid, title, prompt, now], function(err) {
            if (err) reject(err);
            else resolve({ id: presetId });
        });
    });
}

function update(id, { title, prompt }, uid) {
    const db = sqliteClient.getDb();
    const query = `UPDATE prompt_presets SET title = ?, prompt = ?, sync_state = 'dirty' WHERE id = ? AND uid = ? AND is_default = 0`;

    return new Promise((resolve, reject) => {
        db.run(query, [title, prompt, id, uid], function(err) {
            if (err) reject(err);
            else if (this.changes === 0) reject(new Error("Preset not found or permission denied."));
            else resolve({ changes: this.changes });
        });
    });
}

function del(id, uid) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM prompt_presets WHERE id = ? AND uid = ? AND is_default = 0`;

    return new Promise((resolve, reject) => {
        db.run(query, [id, uid], function(err) {
            if (err) reject(err);
            else if (this.changes === 0) reject(new Error("Preset not found or permission denied."));
            else resolve({ changes: this.changes });
        });
    });
}

module.exports = {
    getPresets,
    getPresetTemplates,
    create,
    update,
    delete: del
}; 