const sqliteRepository = require('./sqlite.repository');

// This repository is not user-specific, so we always return sqlite.
function getRepository() {
    return sqliteRepository;
}

module.exports = {
    markKeychainCompleted: (...args) => getRepository().markKeychainCompleted(...args),
    checkKeychainCompleted: (...args) => getRepository().checkKeychainCompleted(...args),
}; 