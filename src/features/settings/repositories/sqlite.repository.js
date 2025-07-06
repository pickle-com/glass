const sqliteClient = require('../../../common/services/sqliteClient');

function getSettings(uid) {
    const db = sqliteClient.getDb();
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM user_settings 
            WHERE uid = ?
        `;
        db.get(query, [uid], (err, row) => {
            if (err) {
                console.error('SQLite: Failed to get settings:', err);
                reject(err);
            } else if (row) {
                // Parse JSON fields
                try {
                    if (row.keybinds) row.keybinds = JSON.parse(row.keybinds);
                } catch (parseError) {
                    console.warn('SQLite: Failed to parse keybinds JSON:', parseError);
                    row.keybinds = {};
                }
                resolve(row);
            } else {
                // Return default settings if none exist
                resolve({
                    uid: uid,
                    profile: 'school',
                    language: 'en',
                    screenshot_interval: '5000',
                    image_quality: '0.8',
                    layout_mode: 'stacked',
                    keybinds: {},
                    throttle_tokens: 500,
                    max_tokens: 2000,
                    throttle_percent: 80,
                    google_search_enabled: 0,
                    background_transparency: 0.5,
                    font_size: 14,
                    content_protection: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    updated_at: Math.floor(Date.now() / 1000)
                });
            }
        });
    });
}

function saveSettings(uid, settings) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    return new Promise((resolve, reject) => {
        // Prepare settings object
        const settingsToSave = {
            uid: uid,
            profile: settings.profile || 'school',
            language: settings.language || 'en',
            screenshot_interval: settings.screenshot_interval || '5000',
            image_quality: settings.image_quality || '0.8',
            layout_mode: settings.layout_mode || 'stacked',
            keybinds: JSON.stringify(settings.keybinds || {}),
            throttle_tokens: settings.throttle_tokens || 500,
            max_tokens: settings.max_tokens || 2000,
            throttle_percent: settings.throttle_percent || 80,
            google_search_enabled: settings.google_search_enabled ? 1 : 0,
            background_transparency: settings.background_transparency || 0.5,
            font_size: settings.font_size || 14,
            content_protection: settings.content_protection ? 1 : 0,
            updated_at: now
        };

        const query = `
            INSERT INTO user_settings (
                uid, profile, language, screenshot_interval, image_quality, layout_mode,
                keybinds, throttle_tokens, max_tokens, throttle_percent, google_search_enabled,
                background_transparency, font_size, content_protection, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
                profile=excluded.profile,
                language=excluded.language,
                screenshot_interval=excluded.screenshot_interval,
                image_quality=excluded.image_quality,
                layout_mode=excluded.layout_mode,
                keybinds=excluded.keybinds,
                throttle_tokens=excluded.throttle_tokens,
                max_tokens=excluded.max_tokens,
                throttle_percent=excluded.throttle_percent,
                google_search_enabled=excluded.google_search_enabled,
                background_transparency=excluded.background_transparency,
                font_size=excluded.font_size,
                content_protection=excluded.content_protection,
                updated_at=excluded.updated_at
        `;

        const values = [
            settingsToSave.uid,
            settingsToSave.profile,
            settingsToSave.language,
            settingsToSave.screenshot_interval,
            settingsToSave.image_quality,
            settingsToSave.layout_mode,
            settingsToSave.keybinds,
            settingsToSave.throttle_tokens,
            settingsToSave.max_tokens,
            settingsToSave.throttle_percent,
            settingsToSave.google_search_enabled,
            settingsToSave.background_transparency,
            settingsToSave.font_size,
            settingsToSave.content_protection,
            now, // created_at
            settingsToSave.updated_at
        ];

        db.run(query, values, function(err) {
            if (err) {
                console.error('SQLite: Failed to save settings:', err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

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
    const presetId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `INSERT INTO prompt_presets (id, uid, title, prompt, is_default, created_at, sync_state) VALUES (?, ?, ?, ?, 0, ?, 'dirty')`;
    
    return new Promise((resolve, reject) => {
        db.run(query, [presetId, uid, title, prompt, now], function(err) {
            if (err) {
                console.error('SQLite: Failed to create preset:', err);
                reject(err);
            } else {
                resolve({ id: presetId });
            }
        });
    });
}

function updatePreset(id, { title, prompt }, uid) {
    const db = sqliteClient.getDb();
    const query = `UPDATE prompt_presets SET title = ?, prompt = ?, sync_state = 'dirty' WHERE id = ? AND uid = ? AND is_default = 0`;

    return new Promise((resolve, reject) => {
        db.run(query, [title, prompt, id, uid], function(err) {
            if (err) {
                console.error('SQLite: Failed to update preset:', err);
                reject(err);
            } else if (this.changes === 0) {
                reject(new Error("Preset not found or permission denied."));
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function deletePreset(id, uid) {
    const db = sqliteClient.getDb();
    const query = `DELETE FROM prompt_presets WHERE id = ? AND uid = ? AND is_default = 0`;

    return new Promise((resolve, reject) => {
        db.run(query, [id, uid], function(err) {
            if (err) {
                console.error('SQLite: Failed to delete preset:', err);
                reject(err);
            } else if (this.changes === 0) {
                reject(new Error("Preset not found or permission denied."));
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

module.exports = {
    getSettings,
    saveSettings,
    getPresets,
    getPresetTemplates,
    createPreset,
    updatePreset,
    deletePreset,
};