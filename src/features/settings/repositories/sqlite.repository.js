const sqliteClient = require('../../common/services/sqliteClient');

function getPresets(uid) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM prompt_presets 
        WHERE uid = ? OR is_default = 1 
        ORDER BY is_default DESC, title ASC
    `;
    
    try {
        return db.prepare(query).all(uid) || [];
    } catch (err) {
        console.error('SQLite: Failed to get presets:', err);
        throw err;
    }
}

function getPresetTemplates() {
    const db = sqliteClient.getDb();
    const query = `
        SELECT * FROM prompt_presets 
        WHERE is_default = 1 
        ORDER BY title ASC
    `;
    
    try {
        return db.prepare(query).all() || [];
    } catch (err) {
        console.error('SQLite: Failed to get preset templates:', err);
        throw err;
    }
}

function createPreset({ uid, title, prompt }) {
    const db = sqliteClient.getDb();
    const id = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `
        INSERT INTO prompt_presets (id, uid, title, prompt, is_default, created_at, sync_state)
        VALUES (?, ?, ?, ?, 0, ?, 'dirty')
    `;
    
    try {
        db.prepare(query).run(id, uid, title, prompt, now);
        return { id };
    } catch (err) {
        console.error('SQLite: Failed to create preset:', err);
        throw err;
    }
}

function updatePreset(id, { title, prompt }, uid) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    const query = `
        UPDATE prompt_presets 
        SET title = ?, prompt = ?, sync_state = 'dirty', updated_at = ?
        WHERE id = ? AND uid = ? AND is_default = 0
    `;
    
    try {
        const result = db.prepare(query).run(title, prompt, now, id, uid);
        if (result.changes === 0) {
            throw new Error('Preset not found, is default, or permission denied');
        }
        return { changes: result.changes };
    } catch (err) {
        console.error('SQLite: Failed to update preset:', err);
        throw err;
    }
}

function deletePreset(id, uid) {
    const db = sqliteClient.getDb();
    const query = `
        DELETE FROM prompt_presets 
        WHERE id = ? AND uid = ? AND is_default = 0
    `;
    
    try {
        const result = db.prepare(query).run(id, uid);
        if (result.changes === 0) {
            throw new Error('Preset not found, is default, or permission denied');
        }
        return { changes: result.changes };
    } catch (err) {
        console.error('SQLite: Failed to delete preset:', err);
        throw err;
    }
}

function getAutoUpdate(uid) {
    const db = sqliteClient.getDb();
    const targetUid = uid;

    try {
        const row = db.prepare('SELECT auto_update_enabled FROM users WHERE uid = ?').get(targetUid);
        
        if (row) {
            console.log('SQLite: Auto update setting found:', row.auto_update_enabled);
            return row.auto_update_enabled !== 0;
        } else {
            // User doesn't exist, create them with default settings
            const now = Math.floor(Date.now() / 1000);
            const stmt = db.prepare(
                'INSERT OR REPLACE INTO users (uid, display_name, email, created_at, auto_update_enabled) VALUES (?, ?, ?, ?, ?)');
            stmt.run(targetUid, 'User', 'user@example.com', now, 1);
            return true; // default to enabled
        }
    } catch (error) {
        console.error('SQLite: Error getting auto_update_enabled setting:', error);
        return true; // fallback to enabled
    }
}

function setAutoUpdate(uid, isEnabled) {
    const db = sqliteClient.getDb();
    const targetUid = uid || sqliteClient.defaultUserId;
    
    try {
        const result = db.prepare('UPDATE users SET auto_update_enabled = ? WHERE uid = ?').run(isEnabled ? 1 : 0, targetUid);
        
        // If no rows were updated, the user might not exist, so create them
        if (result.changes === 0) {
            const now = Math.floor(Date.now() / 1000);
            const stmt = db.prepare('INSERT OR REPLACE INTO users (uid, display_name, email, created_at, auto_update_enabled) VALUES (?, ?, ?, ?, ?)');
            stmt.run(targetUid, 'User', 'user@example.com', now, isEnabled ? 1 : 0);
        }
        
        return { success: true };
    } catch (error) {
        console.error('SQLite: Error setting auto-update:', error);
        throw error;
    }
}

module.exports = {
    getPresets,
    getPresetTemplates,
    createPreset,
    updatePreset,
    deletePreset,
    getAutoUpdate,
    setAutoUpdate
};