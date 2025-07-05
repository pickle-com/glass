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

    async findOrCreateUser(user) {
        return new Promise((resolve, reject) => {
            const { uid, display_name, email } = user;
            const now = Math.floor(Date.now() / 1000);

            const query = `
                INSERT INTO users (uid, display_name, email, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(uid) DO UPDATE SET 
                    display_name=excluded.display_name, 
                    email=excluded.email
            `;
            
            this.db.run(query, [uid, display_name, email, now], (err) => {
                if (err) {
                    console.error('Failed to find or create user in SQLite:', err);
                    return reject(err);
                }
                this.getUser(uid).then(resolve).catch(reject);
            });
        });
    }

    async getUser(uid) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE uid = ?', [uid], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async saveApiKey(apiKey, uid = this.defaultUserId, provider = 'openai') {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET api_key = ?, provider = ? WHERE uid = ?',
                [apiKey, provider, uid],
                function(err) {
                    if (err) {
                        console.error('SQLite: Failed to save API key:', err);
                        reject(err);
                    } else {
                        console.log(`SQLite: API key saved for user ${uid} with provider ${provider}.`);
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async getPresets(uid) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM prompt_presets 
                WHERE uid = ? OR is_default = 1 
                ORDER BY is_default DESC, title ASC
            `;
            this.db.all(query, [uid], (err, rows) => {
                if (err) {
                    console.error('SQLite: Failed to get presets:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getPresetTemplates() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM prompt_presets 
                WHERE is_default = 1 
                ORDER BY title ASC
            `;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('SQLite: Failed to get preset templates:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getSession(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM sessions WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async updateSessionType(id, type) {
        return new Promise((resolve, reject) => {
            const now = Math.floor(Date.now() / 1000);
            const query = 'UPDATE sessions SET session_type = ?, updated_at = ? WHERE id = ?';
            this.db.run(query, [type, now, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async touchSession(id) {
        return new Promise((resolve, reject) => {
            const now = Math.floor(Date.now() / 1000);
            const query = 'UPDATE sessions SET updated_at = ? WHERE id = ?';
            this.db.run(query, [now, id], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    async createSession(uid, type = 'ask') {
        return new Promise((resolve, reject) => {
            const sessionId = require('crypto').randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const query = `INSERT INTO sessions (id, uid, title, session_type, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(query, [sessionId, uid, `Session @ ${new Date().toLocaleTimeString()}`, type, now, now], function(err) {
                if (err) {
                    console.error('SQLite: Failed to create session:', err);
                    reject(err);
                } else {
                    console.log(`SQLite: Created session ${sessionId} for user ${uid} (type: ${type})`);
                    resolve(sessionId);
                }
            });
        });
    }

    async endSession(sessionId) {
        return new Promise((resolve, reject) => {
            const now = Math.floor(Date.now() / 1000);
            const query = `UPDATE sessions SET ended_at = ?, updated_at = ? WHERE id = ?`;
            this.db.run(query, [now, now, sessionId], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    async addTranscript({ sessionId, speaker, text }) {
        return new Promise((resolve, reject) => {
            this.touchSession(sessionId).catch(err => console.error("Failed to touch session", err));
            const transcriptId = require('crypto').randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const query = `INSERT INTO transcripts (id, session_id, start_at, speaker, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
            this.db.run(query, [transcriptId, sessionId, now, speaker, text, now], function(err) {
                if (err) reject(err);
                else resolve({ id: transcriptId });
            });
        });
    }

    async addAiMessage({ sessionId, role, content, model = 'gpt-4.1' }) {
         return new Promise((resolve, reject) => {
            this.touchSession(sessionId).catch(err => console.error("Failed to touch session", err));
            const messageId = require('crypto').randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const query = `INSERT INTO ai_messages (id, session_id, sent_at, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            this.db.run(query, [messageId, sessionId, now, role, content, model, now], function(err) {
                if (err) reject(err);
                else resolve({ id: messageId });
            });
        });
    }

    async saveSummary({ sessionId, tldr, text, bullet_json, action_json, model = 'gpt-4.1' }) {
        return new Promise((resolve, reject) => {
            this.touchSession(sessionId).catch(err => console.error("Failed to touch session", err));
            const now = Math.floor(Date.now() / 1000);
            const query = `
                INSERT INTO summaries (session_id, generated_at, model, text, tldr, bullet_json, action_json, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    generated_at=excluded.generated_at,
                    model=excluded.model,
                    text=excluded.text,
                    tldr=excluded.tldr,
                    bullet_json=excluded.bullet_json,
                    action_json=excluded.action_json,
                    updated_at=excluded.updated_at
            `;
            this.db.run(query, [sessionId, now, model, text, tldr, bullet_json, action_json, now], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    async runMigrations() {
        return new Promise((resolve, reject) => {
            console.log('[DB Migration] Checking schema for `sessions` table...');
            this.db.all("PRAGMA table_info(sessions)", (err, columns) => {
                if (err) {
                    console.error('[DB Migration] Error checking sessions table schema:', err);
                    return reject(err);
                }

                const hasSessionTypeCol = columns.some(col => col.name === 'session_type');

                if (!hasSessionTypeCol) {
                    console.log('[DB Migration] `session_type` column missing. Altering table...');
                    this.db.run("ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'ask'", (alterErr) => {
                        if (alterErr) {
                            console.error('[DB Migration] Failed to add `session_type` column:', alterErr);
                            return reject(alterErr);
                        }
                        console.log('[DB Migration] `sessions` table updated successfully.');
                        resolve();
                    });
                } else {
                    console.log('[DB Migration] Schema is up to date.');
                    resolve();
                }
            });
        });
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