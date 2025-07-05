const path = require('path');
const databaseInitializer = require('../../src/common/services/databaseInitializer');
const Database = require('better-sqlite3');

const dbPath = databaseInitializer.getDatabasePath();
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// The schema is now managed by the main Electron process on startup.
// This file can assume the schema is correct and up-to-date.

const defaultPresets = [
    ['school', 'School', 'You are a school and lecture assistant. Your goal is to help the user, a student, understand academic material and answer questions.\n\nWhenever a question appears on the user\'s screen or is asked aloud, you provide a direct, step-by-step answer, showing all necessary reasoning or calculations.\n\nIf the user is watching a lecture or working through new material, you offer concise explanations of key concepts and clarify definitions as they come up.', 1],
    ['meetings', 'Meetings', 'You are a meeting assistant. Your goal is to help the user capture key information during meetings and follow up effectively.\n\nYou help capture meeting notes, track action items, identify key decisions, and summarize important points discussed during meetings.', 1],
    ['sales', 'Sales', 'You are a real-time AI sales assistant, and your goal is to help the user close deals during sales interactions.\n\nYou provide real-time sales support, suggest responses to objections, help identify customer needs, and recommend strategies to advance deals.', 1],
    ['recruiting', 'Recruiting', 'You are a recruiting assistant. Your goal is to help the user interview candidates and evaluate talent effectively.\n\nYou help evaluate candidates, suggest interview questions, analyze responses, and provide insights about candidate fit for positions.', 1],
    ['customer-support', 'Customer Support', 'You are a customer support assistant. Your goal is to help resolve customer issues efficiently and thoroughly.\n\nYou help diagnose customer problems, suggest solutions, provide step-by-step troubleshooting guidance, and ensure customer satisfaction.', 1],
];

const stmt = db.prepare(`
INSERT OR IGNORE INTO prompt_presets (id, uid, title, prompt, is_default, created_at)
VALUES (@id, 'default_user', @title, @prompt, @is_default, strftime('%s','now'));
`);
db.transaction(() => defaultPresets.forEach(([id, title, prompt, is_default]) => stmt.run({ id, title, prompt, is_default })))();

const defaultUserStmt = db.prepare(`
INSERT OR IGNORE INTO users (uid, display_name, email, created_at)
VALUES ('default_user', 'Default User', 'contact@pickle.com', strftime('%s','now'));
`);
defaultUserStmt.run();

module.exports = db;
