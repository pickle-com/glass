const sqliteRepository = require('./sqlite.repository');

// This repository is not user-specific, so we always return sqlite.
function getRepository() {
    return sqliteRepository;
}

module.exports = {
    markPermissionsAsCompleted: (...args) => getRepository().markPermissionsAsCompleted(...args),
    checkPermissionsCompleted: (...args) => getRepository().checkPermissionsCompleted(...args),
}; 