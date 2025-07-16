const sqliteClient = require('../../services/sqliteClient');
const encryptionService = require('../../services/encryptionService');

function getByProvider(provider) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT * FROM provider_settings WHERE provider = ?');
    const result = stmt.get(provider) || null;
    
    if (result && result.api_key && encryptionService.looksEncrypted(result.api_key)) {
        result.api_key = encryptionService.decrypt(result.api_key);
    }
    
    return result;
}

function getAll() {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT * FROM provider_settings ORDER BY provider');
    const results = stmt.all();
    
    return results.map(result => {
        if (result.api_key && encryptionService.looksEncrypted(result.api_key)) {
            result.api_key = encryptionService.decrypt(result.api_key);
        }
        return result;
    });
}

function upsert(provider, settings) {
    // Validate: prevent direct setting of active status
    if (settings.is_active_llm || settings.is_active_stt) {
        console.warn('[ProviderSettings] Warning: is_active_llm/is_active_stt should not be set directly. Use setActiveProvider() instead.');
    }
    
    const db = sqliteClient.getDb();
    
    // Use SQLite's UPSERT syntax (INSERT ... ON CONFLICT ... DO UPDATE)
    const stmt = db.prepare(`
        INSERT INTO provider_settings (provider, api_key, selected_llm_model, selected_stt_model, is_active_llm, is_active_stt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
            api_key = excluded.api_key,
            selected_llm_model = excluded.selected_llm_model,
            selected_stt_model = excluded.selected_stt_model,
            -- is_active_llm and is_active_stt are NOT updated here
            -- Use setActiveProvider() to change active status
            updated_at = excluded.updated_at
    `);
    
    const result = stmt.run(
        provider,
        settings.api_key || null,
        settings.selected_llm_model || null,
        settings.selected_stt_model || null,
        0, // is_active_llm - always 0, use setActiveProvider to activate
        0, // is_active_stt - always 0, use setActiveProvider to activate
        settings.created_at || Date.now(),
        settings.updated_at
    );
    
    return { changes: result.changes };
}

function remove(provider) {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('DELETE FROM provider_settings WHERE provider = ?');
    const result = stmt.run(provider);
    return { changes: result.changes };
}

function removeAll() {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('DELETE FROM provider_settings');
    const result = stmt.run();
    return { changes: result.changes };
}

function getRawApiKeys() {
    const db = sqliteClient.getDb();
    const stmt = db.prepare('SELECT api_key FROM provider_settings');
    return stmt.all();
}

// Get active provider for a specific type (llm or stt)
function getActiveProvider(type) {
    const db = sqliteClient.getDb();
    const column = type === 'llm' ? 'is_active_llm' : 'is_active_stt';
    const stmt = db.prepare(`SELECT * FROM provider_settings WHERE ${column} = 1`);
    const result = stmt.get() || null;
    
    if (result && result.api_key && encryptionService.looksEncrypted(result.api_key)) {
        result.api_key = encryptionService.decrypt(result.api_key);
    }
    
    return result;
}

// Set active provider for a specific type
function setActiveProvider(provider, type) {
    const db = sqliteClient.getDb();
    const column = type === 'llm' ? 'is_active_llm' : 'is_active_stt';
    
    // Start transaction to ensure only one provider is active
    db.transaction(() => {
        // First, deactivate all providers for this type
        const deactivateStmt = db.prepare(`UPDATE provider_settings SET ${column} = 0`);
        deactivateStmt.run();
        
        // Then activate the specified provider
        if (provider) {
            const activateStmt = db.prepare(`UPDATE provider_settings SET ${column} = 1 WHERE provider = ?`);
            activateStmt.run(provider);
        }
    })();
    
    return { success: true };
}

// Get all active settings (both llm and stt)
function getActiveSettings() {
    const db = sqliteClient.getDb();
    const stmt = db.prepare(`
        SELECT * FROM provider_settings 
        WHERE (is_active_llm = 1 OR is_active_stt = 1)
        ORDER BY provider
    `);
    const results = stmt.all();
    
    // Decrypt API keys and organize by type
    const activeSettings = {
        llm: null,
        stt: null
    };
    
    results.forEach(result => {
        if (result.api_key && encryptionService.looksEncrypted(result.api_key)) {
            result.api_key = encryptionService.decrypt(result.api_key);
        }
        if (result.is_active_llm) {
            activeSettings.llm = result;
        }
        if (result.is_active_stt) {
            activeSettings.stt = result;
        }
    });
    
    return activeSettings;
}

module.exports = {
    getByProvider,
    getAll,
    upsert,
    remove,
    removeAll,
    getRawApiKeys,
    getActiveProvider,
    setActiveProvider,
    getActiveSettings
}; 