const sqliteClient = require('../../services/sqliteClient');

function markKeychainCompleted(uid) {
    return sqliteClient.query(
        'INSERT OR REPLACE INTO permissions (uid, keychain_completed) VALUES (?, 1)',
        [uid]
    );
}

function checkKeychainCompleted(uid) {
    const row = sqliteClient.query('SELECT keychain_completed FROM permissions WHERE uid = ?', [uid]);
    return row.length > 0 && row[0].keychain_completed === 1;
}

module.exports = {
    markKeychainCompleted,
    checkKeychainCompleted
}; 