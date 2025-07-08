const Database = require('better-sqlite3');
const path = require('path');
const LATEST_SCHEMA = require('../config/schema');

class SQLiteClient {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.defaultUserId = 'default_user';
    }

    connect(dbPath) {
        if (this.db) {
            console.log('[SQLiteClient] Already connected.');
            return;
        }

        try {
            this.dbPath = dbPath;
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            console.log('[SQLiteClient] Connected successfully to:', this.dbPath);
        } catch (err) {
            console.error('[SQLiteClient] Could not connect to database', err);
            throw err;
        }
    }

    getDb() {
        if (!this.db) {
            throw new Error("Database not connected. Call connect() first.");
        }
        return this.db;
    }

    synchronizeSchema() {
        console.log('[DB Sync] Starting schema synchronization...');
        const tablesInDb = this.getTablesFromDb();

        for (const tableName of Object.keys(LATEST_SCHEMA)) {
            const tableSchema = LATEST_SCHEMA[tableName];

            if (!tablesInDb.includes(tableName)) {
                // Table doesn't exist, create it
                this.createTable(tableName, tableSchema);
            } else {
                // Table exists, check for missing columns
                this.updateTable(tableName, tableSchema);
            }
        }
        console.log('[DB Sync] Schema synchronization finished.');
    }

    getTablesFromDb() {
        const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        return tables.map(t => t.name);
    }

    createTable(tableName, tableSchema) {
        const columnDefs = tableSchema.columns.map(col => `"${col.name}" ${col.type}`).join(', ');
        const query = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs})`;

        console.log(`[DB Sync] Creating table: ${tableName}`);
        this.db.prepare(query).run();
    }

    updateTable(tableName, tableSchema) {
        const existingColumns = this.db.prepare(`PRAGMA table_info("${tableName}")`).all();
        const existingColumnNames = existingColumns.map(c => c.name);
        const columnsToAdd = tableSchema.columns.filter(col => !existingColumnNames.includes(col.name));

        if (columnsToAdd.length > 0) {
            console.log(`[DB Sync] Updating table: ${tableName}. Adding columns: ${columnsToAdd.map(c=>c.name).join(', ')}`);
            for (const column of columnsToAdd) {
                const addColumnQuery = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`;
                this.db.prepare(addColumnQuery).run();
            }
        }
    }

    runQuery(query, params = []) {
        return this.db.prepare(query).run(params);
    }

    cleanupEmptySessions() {
        console.log('[DB Cleanup] Checking for empty sessions...');
        const query = `
            SELECT s.id FROM sessions s
            LEFT JOIN transcripts t ON s.id = t.session_id
            LEFT JOIN ai_messages a ON s.id = a.session_id
            LEFT JOIN summaries su ON s.id = su.session_id
            WHERE t.id IS NULL AND a.id IS NULL AND su.session_id IS NULL
        `;

        const rows = this.db.prepare(query).all();

        if (rows.length === 0) {
            console.log('[DB Cleanup] No empty sessions found.');
            return;
        }

        const idsToDelete = rows.map(r => r.id);
        const placeholders = idsToDelete.map(() => '?').join(',');
        const deleteQuery = `DELETE FROM sessions WHERE id IN (${placeholders})`;

        console.log(`[DB Cleanup] Found ${idsToDelete.length} empty sessions. Deleting...`);
        const result = this.db.prepare(deleteQuery).run(idsToDelete);
        console.log(`[DB Cleanup] Successfully deleted ${result.changes} empty sessions.`);
    }

    initTables() {
        this.synchronizeSchema();
        this.initDefaultData();
    }

    initDefaultData() {
        const now = Math.floor(Date.now() / 1000);
        const initUserQuery = `
            INSERT OR IGNORE INTO users (uid, display_name, email, created_at)
            VALUES (?, ?, ?, ?)
        `;

        this.db.prepare(initUserQuery).run(this.defaultUserId, 'Default User', 'contact@pickle.com', now);

        const defaultPresets = [
            ['school', 'School', 'You are a school and lecture assistant. Your goal is to help the user, a student, understand academic material and answer questions.\n\nWhenever a question appears on the user\'s screen or is asked aloud, you provide a direct, step-by-step answer, showing all necessary reasoning or calculations.\n\nIf the user is watching a lecture or working through new material, you offer concise explanations of key concepts and clarify definitions as they come up.', 1],
            ['meetings', 'Meetings', 'You are a meeting assistant. Your goal is to help the user capture key information during meetings and follow up effectively.\n\nYou help capture meeting notes, track action items, identify key decisions, and summarize important points discussed during meetings.', 1],
            ['sales', 'Sales', 'You are a real-time AI sales assistant, and your goal is to help the user close deals during sales interactions.\n\nYou provide real-time sales support, suggest responses to objections, help identify customer needs, and recommend strategies to advance deals.', 1],
            ['recruiting', 'Recruiting', 'You are a recruiting assistant. Your goal is to help the user interview candidates and evaluate talent effectively.\n\nYou help evaluate candidates, suggest interview questions, analyze responses, and provide insights about candidate fit for positions.', 1],
            ['customer-support', 'Customer Support', 'You are a customer support assistant. Your goal is to help resolve customer issues efficiently and thoroughly.\n\nYou help diagnose customer problems, suggest solutions, provide step-by-step troubleshooting guidance, and ensure customer satisfaction.', 1],
        ];

        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO prompt_presets (id, uid, title, prompt, is_default, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const preset of defaultPresets) {
            stmt.run(preset[0], this.defaultUserId, preset[1], preset[2], preset[3], now);
        }

        console.log('Default data initialized.');
    }

    markPermissionsAsCompleted() {
        return this.query(
            'INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
            ['permissions_completed', 'true']
        );
    }

    checkPermissionsCompleted() {
        const result = this.query(
            'SELECT value FROM system_settings WHERE key = ?',
            ['permissions_completed']
        );
        return result.length > 0 && result[0].value === 'true';
    }

    getAutoUpdate(uid = this.defaultUserId) {
        try {
            const row = this.query(
                'SELECT auto_update_enabled FROM users WHERE uid = ?',
                [uid]
            );
            
            if (row.length > 0) {
                return row[0].auto_update_enabled !== 0;
            } else {
                // User doesn't exist, create them with default settings
                const now = Math.floor(Date.now() / 1000);
                this.query(
                    'INSERT OR REPLACE INTO users (uid, display_name, email, created_at, auto_update_enabled) VALUES (?, ?, ?, ?, ?)',
                    [uid, 'User', 'user@example.com', now, 1]
                );
                return true; // default to enabled
            }
        } catch (error) {
            console.error('Error getting auto_update_enabled setting:', error);
            return true; // fallback to enabled
        }
    }

    setAutoUpdate(isEnabled, uid = this.defaultUserId) {
        try {
            const result = this.query(
                'UPDATE users SET auto_update_enabled = ? WHERE uid = ?',
                [isEnabled ? 1 : 0, uid]
            );
            
            // If no rows were updated, the user might not exist, so create them
            if (result.changes === 0) {
                const now = Math.floor(Date.now() / 1000);
                this.query(
                    'INSERT OR REPLACE INTO users (uid, display_name, email, created_at, auto_update_enabled) VALUES (?, ?, ?, ?, ?)',
                    [uid, 'User', 'user@example.com', now, isEnabled ? 1 : 0]
                );
            }
            
            return result;
        } catch (error) {
            console.error('Error setting auto-update:', error);
            throw error;
        }
    }

    close() {
        if (this.db) {
            try {
                this.db.close();
                console.log('SQLite connection closed.');
            } catch (err) {
                console.error('SQLite connection close failed:', err);
            }
            this.db = null;
        }
    }

    query(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        try {
            if (sql.toUpperCase().startsWith('SELECT')) {
                return this.db.prepare(sql).all(params);
            } else {
                const result = this.db.prepare(sql).run(params);
                return { changes: result.changes, lastID: result.lastID };
            }
        } catch (err) {
            console.error('Query error:', err);
            throw err;
        }
    }
}

const sqliteClient = new SQLiteClient();
module.exports = sqliteClient; 