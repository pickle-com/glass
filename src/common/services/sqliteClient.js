const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

    async initTables() {
        return new Promise((resolve, reject) => {
            const schema = `
                PRAGMA journal_mode = WAL;

                CREATE TABLE IF NOT EXISTS users (
                  uid           TEXT PRIMARY KEY,
                  display_name  TEXT NOT NULL,
                  email         TEXT NOT NULL,
                  created_at    INTEGER,
                  api_key       TEXT,
                  provider      TEXT DEFAULT 'openai'
                );

                CREATE TABLE IF NOT EXISTS sessions (
                  id            TEXT PRIMARY KEY, 
                  uid           TEXT NOT NULL,
                  title         TEXT,
                  started_at    INTEGER,
                  ended_at      INTEGER,
                  sync_state    TEXT DEFAULT 'clean',
                  updated_at    INTEGER
                );

                CREATE TABLE IF NOT EXISTS transcripts (
                  id            TEXT PRIMARY KEY,
                  session_id    TEXT NOT NULL,
                  start_at      INTEGER,
                  end_at        INTEGER,
                  speaker       TEXT,
                  text          TEXT,
                  lang          TEXT,
                  created_at    INTEGER,
                  sync_state    TEXT DEFAULT 'clean'
                );

                CREATE TABLE IF NOT EXISTS ai_messages (
                  id            TEXT PRIMARY KEY,
                  session_id    TEXT NOT NULL,
                  sent_at       INTEGER,
                  role          TEXT,
                  content       TEXT,
                  tokens        INTEGER,
                  model         TEXT,
                  created_at    INTEGER,
                  sync_state    TEXT DEFAULT 'clean'
                );

                CREATE TABLE IF NOT EXISTS summaries (
                  session_id    TEXT PRIMARY KEY,
                  generated_at  INTEGER,
                  model         TEXT,
                  text          TEXT,
                  tldr          TEXT,
                  bullet_json   TEXT,
                  action_json   TEXT,
                  tokens_used   INTEGER,
                  updated_at    INTEGER,
                  sync_state    TEXT DEFAULT 'clean'
                );

                CREATE TABLE IF NOT EXISTS prompt_presets (
                  id            TEXT PRIMARY KEY,
                  uid           TEXT NOT NULL,
                  title         TEXT NOT NULL,
                  prompt        TEXT NOT NULL,
                  is_default    INTEGER NOT NULL,
                  created_at    INTEGER,
                  sync_state    TEXT DEFAULT 'clean'
                );
            `;

            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('Failed to create tables:', err);
                    return reject(err);
                }
                console.log('All tables are ready.');
                
                // Add provider column to existing databases
                this.db.run("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'openai'", (alterErr) => {
                    if (alterErr && !alterErr.message.includes('duplicate column')) {
                        console.log('Note: Could not add provider column (may already exist)');
                    }
                    this.initDefaultData().then(resolve).catch(reject);
                });
            });
        });
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

    async createSession(uid) {
        return new Promise((resolve, reject) => {
            const sessionId = require('crypto').randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const query = `INSERT INTO sessions (id, uid, title, started_at, updated_at) VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(query, [sessionId, uid, `Session @ ${new Date().toLocaleTimeString()}`, now, now], function(err) {
                if (err) {
                    console.error('SQLite: Failed to create session:', err);
                    reject(err);
                } else {
                    console.log(`SQLite: Created session ${sessionId} for user ${uid}`);
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
}

const sqliteClient = new SQLiteClient();
module.exports = sqliteClient; 