const sqliteClient = require('../../services/sqliteClient');

async function markPermissionsAsCompleted() {
    return sqliteClient.markPermissionsAsCompleted();
}

async function checkPermissionsCompleted() {
    return sqliteClient.checkPermissionsCompleted();
}

module.exports = {
    markPermissionsAsCompleted,
    checkPermissionsCompleted,
}; 