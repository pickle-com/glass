const sqliteRepository = require('./sqlite.repository');
// const firebaseRepository = require('./firebase.repository');
const authService = require('../../../common/services/authService');

function getRepository() {
    // const user = authService.getCurrentUser();
    // if (user.isLoggedIn) {
    //     return firebaseRepository;
    // }
    return sqliteRepository;
}

module.exports = {
    getPresets: (...args) => getRepository().getPresets(...args),
    getPresetTemplates: (...args) => getRepository().getPresetTemplates(...args),
    create: (...args) => getRepository().create(...args),
    update: (...args) => getRepository().update(...args),
    delete: (...args) => getRepository().delete(...args),
}; 