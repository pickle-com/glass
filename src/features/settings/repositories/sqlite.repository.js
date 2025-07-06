const sqliteClient = require('../../../common/services/sqliteClient');

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
                resolve(rows || []);
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
                resolve(rows || []);
            }
        });
    });
}

function createPreset({ uid, title, prompt }) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const id = require('crypto').randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const query = `
            INSERT INTO prompt_presets (id, uid, title, prompt, is_default, created_at, sync_state)
            VALUES (?, ?, ?, ?, 0, ?, 'dirty')
        `;
        db.run(query, [id, uid, title, prompt, now], function(err) {
            if (err) {
                console.error('SQLite: Failed to create preset:', err);
                reject(err);
            } else {
                resolve({ id });
            }
        });
    });
}

function updatePreset(id, { title, prompt }, uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        const query = `
            UPDATE prompt_presets 
            SET title = ?, prompt = ?, sync_state = 'dirty', updated_at = ?
            WHERE id = ? AND uid = ? AND is_default = 0
        `;
        db.run(query, [title, prompt, now, id, uid], function(err) {
            if (err) {
                console.error('SQLite: Failed to update preset:', err);
                reject(err);
            } else if (this.changes === 0) {
                reject(new Error('Preset not found, is default, or permission denied'));
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function deletePreset(id, uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = `
            DELETE FROM prompt_presets 
            WHERE id = ? AND uid = ? AND is_default = 0
        `;
        db.run(query, [id, uid], function(err) {
            if (err) {
                console.error('SQLite: Failed to delete preset:', err);
                reject(err);
            } else if (this.changes === 0) {
                reject(new Error('Preset not found, is default, or permission denied'));
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

module.exports = {
    getPresets,
    getPresetTemplates,
    createPreset,
    updatePreset,
    deletePreset
};