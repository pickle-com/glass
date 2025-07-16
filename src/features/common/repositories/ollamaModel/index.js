const sqliteRepository = require('./sqlite.repository');

// For now, we only use SQLite repository
// In the future, we could add cloud sync support

function getRepository() {
    return sqliteRepository;
}

// Export all repository methods
module.exports = {
    getAllModels: (...args) => getRepository().getAllModels(...args),
    getModel: (...args) => getRepository().getModel(...args),
    upsertModel: (...args) => getRepository().upsertModel(...args),
    updateInstallStatus: (...args) => getRepository().updateInstallStatus(...args),
    initializeDefaultModels: (...args) => getRepository().initializeDefaultModels(...args),
    deleteModel: (...args) => getRepository().deleteModel(...args),
    getInstalledModels: (...args) => getRepository().getInstalledModels(...args),
    getInstallingModels: (...args) => getRepository().getInstallingModels(...args)
}; 