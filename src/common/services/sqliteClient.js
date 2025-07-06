const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const LATEST_SCHEMA = require('../config/schema');

class SQLiteClient {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.defaultUserId = 'default_user';
    }

    connect(dbPath) {
        return new Promise((resolve, reject) => {
            if (this.db) {
                console.log('[SQLiteClient] Already connected.');
                return resolve();
            }

            this.dbPath = dbPath;
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('[SQLiteClient] Could not connect to database', err);
                    return reject(err);
                }
                console.log('[SQLiteClient] Connected successfully to:', this.dbPath);
                
                this.db.run('PRAGMA journal_mode = WAL;', (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        });
    }

    getDb() {
        if (!this.db) {
            throw new Error("Database not connected. Call connect() first.");
        }
        return this.db;
    }

    async synchronizeSchema() {
        console.log('[DB Sync] Starting schema synchronization...');
        const tablesInDb = await this.getTablesFromDb();

        for (const tableName of Object.keys(LATEST_SCHEMA)) {
            const tableSchema = LATEST_SCHEMA[tableName];

            if (!tablesInDb.includes(tableName)) {
                // Table doesn't exist, create it
                await this.createTable(tableName, tableSchema);
            } else {
                // Table exists, check for missing columns
                await this.updateTable(tableName, tableSchema);
            }
        }
        console.log('[DB Sync] Schema synchronization finished.');
    }

    async getTablesFromDb() {
        return new Promise((resolve, reject) => {
            this.db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) return reject(err);
                resolve(tables.map(t => t.name));
            });
        });
    }

    async createTable(tableName, tableSchema) {
        return new Promise((resolve, reject) => {
            const columnDefs = tableSchema.columns.map(col => `"${col.name}" ${col.type}`).join(', ');
            const query = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs})`;

            console.log(`[DB Sync] Creating table: ${tableName}`);
            this.db.run(query, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async updateTable(tableName, tableSchema) {
        return new Promise((resolve, reject) => {
            this.db.all(`PRAGMA table_info("${tableName}")`, async (err, existingColumns) => {
                if (err) return reject(err);

                const existingColumnNames = existingColumns.map(c => c.name);
                const columnsToAdd = tableSchema.columns.filter(col => !existingColumnNames.includes(col.name));

                if (columnsToAdd.length > 0) {
                    console.log(`[DB Sync] Updating table: ${tableName}. Adding columns: ${columnsToAdd.map(c=>c.name).join(', ')}`);
                    for (const column of columnsToAdd) {
                        const addColumnQuery = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`;
                        try {
                            await this.runQuery(addColumnQuery);
                        } catch (alterErr) {
                            return reject(alterErr);
                        }
                    }
                }
                resolve();
            });
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) return reject(err);
                resolve(this);
            });
        });
    }

    async cleanupEmptySessions() {
        console.log('[DB Cleanup] Checking for empty sessions...');
        const query = `
            SELECT s.id FROM sessions s
            LEFT JOIN transcripts t ON s.id = t.session_id
            LEFT JOIN ai_messages a ON s.id = a.session_id
            LEFT JOIN summaries su ON s.id = su.session_id
            WHERE t.id IS NULL AND a.id IS NULL AND su.session_id IS NULL
        `;

        return new Promise((resolve, reject) => {
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('[DB Cleanup] Error finding empty sessions:', err);
                    return reject(err);
                }

                if (rows.length === 0) {
                    console.log('[DB Cleanup] No empty sessions found.');
                    return resolve();
                }

                const idsToDelete = rows.map(r => r.id);
                const placeholders = idsToDelete.map(() => '?').join(',');
                const deleteQuery = `DELETE FROM sessions WHERE id IN (${placeholders})`;

                console.log(`[DB Cleanup] Found ${idsToDelete.length} empty sessions. Deleting...`);
                this.db.run(deleteQuery, idsToDelete, function(deleteErr) {
                    if (deleteErr) {
                        console.error('[DB Cleanup] Error deleting empty sessions:', deleteErr);
                        return reject(deleteErr);
                    }
                    console.log(`[DB Cleanup] Successfully deleted ${this.changes} empty sessions.`);
                    resolve();
                });
            });
        });
    }

    async initTables() {
        await this.synchronizeSchema();
        await this.initDefaultData();
    }

    async initDefaultData() {
        return new Promise((resolve, reject) => {
            const now = Math.floor(Date.now() / 1000);
            const initUserQuery = `
                INSERT OR IGNORE INTO users (uid, display_name, email, created_at)
                VALUES (?, ?, ?, ?)
            `;

            this.db.run(initUserQuery, [this.defaultUserId, 'Default User', 'contact@pickle.com', now], (err) => {
                if (err) {
                    console.error('Failed to initialize default user:', err);
                    return reject(err);
                }

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

                stmt.finalize((err) => {
                            if (err) {
                        console.error('Failed to finalize preset statement:', err);
                        return reject(err);
                    }
                    console.log('Default data initialized.');
                    resolve();
                });
            });
        });
    }

    async markPermissionsAsCompleted() {
        return this.query(
            'INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
            ['permissions_completed', 'true']
        );
    }

    async checkPermissionsCompleted() {
        const result = await this.query(
            'SELECT value FROM system_settings WHERE key = ?',
            ['permissions_completed']
        );
        return result.length > 0 && result[0].value === 'true';
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('SQLite connection close failed:', err);
                } else {
                    console.log('SQLite connection closed.');
                }
            });
            this.db = null;
        }
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not connected'));
            }

            if (sql.toUpperCase().startsWith('SELECT')) {
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        console.error('Query error:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            } else {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        console.error('Query error:', err);
                        reject(err);
                    } else {
                        resolve({ changes: this.changes, lastID: this.lastID });
                    }
                });
            }
        });
    }
}

const sqliteClient = new SQLiteClient();
module.exports = sqliteClient; 