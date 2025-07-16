const sqliteClient = require('../../services/sqliteClient');

/**
 * Get all Ollama models
 */
function getAllModels() {
    const db = sqliteClient.getDb();
    const query = 'SELECT * FROM ollama_models ORDER BY name';
    
    try {
        return db.prepare(query).all() || [];
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to get models:', err);
        throw err;
    }
}

/**
 * Get a specific model by name
 */
function getModel(name) {
    const db = sqliteClient.getDb();
    const query = 'SELECT * FROM ollama_models WHERE name = ?';
    
    try {
        return db.prepare(query).get(name);
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to get model:', err);
        throw err;
    }
}

/**
 * Create or update a model entry
 */
function upsertModel({ name, size, installed = false, installing = false }) {
    const db = sqliteClient.getDb();
    const query = `
        INSERT INTO ollama_models (name, size, installed, installing)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET 
            size = excluded.size,
            installed = excluded.installed,
            installing = excluded.installing
    `;
    
    try {
        db.prepare(query).run(name, size, installed ? 1 : 0, installing ? 1 : 0);
        return { success: true };
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to upsert model:', err);
        throw err;
    }
}

/**
 * Update installation status for a model
 */
function updateInstallStatus(name, installed, installing = false) {
    const db = sqliteClient.getDb();
    const query = 'UPDATE ollama_models SET installed = ?, installing = ? WHERE name = ?';
    
    try {
        const result = db.prepare(query).run(installed ? 1 : 0, installing ? 1 : 0, name);
        return { success: true, changes: result.changes };
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to update install status:', err);
        throw err;
    }
}

/**
 * Initialize default models - now done dynamically based on installed models
 */
function initializeDefaultModels() {
    // Default models are now detected dynamically from Ollama installation
    // This function maintains compatibility but doesn't hardcode any models
    console.log('[OllamaModel Repository] Default models initialization skipped - using dynamic detection');
    return { success: true };
}

/**
 * Delete a model entry
 */
function deleteModel(name) {
    const db = sqliteClient.getDb();
    const query = 'DELETE FROM ollama_models WHERE name = ?';
    
    try {
        const result = db.prepare(query).run(name);
        return { success: true, changes: result.changes };
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to delete model:', err);
        throw err;
    }
}

/**
 * Get installed models
 */
function getInstalledModels() {
    const db = sqliteClient.getDb();
    const query = 'SELECT * FROM ollama_models WHERE installed = 1 ORDER BY name';
    
    try {
        return db.prepare(query).all() || [];
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to get installed models:', err);
        throw err;
    }
}

/**
 * Get models currently being installed
 */
function getInstallingModels() {
    const db = sqliteClient.getDb();
    const query = 'SELECT * FROM ollama_models WHERE installing = 1 ORDER BY name';
    
    try {
        return db.prepare(query).all() || [];
    } catch (err) {
        console.error('[OllamaModel Repository] Failed to get installing models:', err);
        throw err;
    }
}

module.exports = {
    getAllModels,
    getModel,
    upsertModel,
    updateInstallStatus,
    initializeDefaultModels,
    deleteModel,
    getInstalledModels,
    getInstallingModels
}; 