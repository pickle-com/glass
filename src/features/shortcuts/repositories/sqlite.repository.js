const sqliteClient = require('../../common/services/sqliteClient');
const crypto = require('crypto');

function getAllKeybinds() {
    const db = sqliteClient.getDb();
    const query = 'SELECT * FROM shortcuts';
    try {
        return db.prepare(query).all();
    } catch (error) {
        console.error(`[DB] Failed to get keybinds:`, error);
        return [];
    }
}

function upsertKeybinds(keybinds) {
    if (!keybinds || keybinds.length === 0) return;

    const db = sqliteClient.getDb();
    const upsert = db.transaction((items) => {
        const query = `
            INSERT INTO shortcuts (action, accelerator, created_at)
            VALUES (@action, @accelerator, @created_at)
            ON CONFLICT(action) DO UPDATE SET
                accelerator = excluded.accelerator;
        `;
        const insert = db.prepare(query);

        for (const item of items) {
            insert.run({
                action: item.action,
                accelerator: item.accelerator,
                created_at: Math.floor(Date.now() / 1000)
            });
        }
    });

    try {
        upsert(keybinds);
    } catch (error) {
        console.error('[DB] Failed to upsert keybinds:', error);
        throw error;
    }
}

module.exports = {
    getAllKeybinds,
    upsertKeybinds
}; 