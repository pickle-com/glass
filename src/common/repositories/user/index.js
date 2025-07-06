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
    findOrCreate: (...args) => getRepository().findOrCreate(...args),
    getById: (...args) => getRepository().getById(...args),
    saveApiKey: (...args) => getRepository().saveApiKey(...args),
    update: (...args) => getRepository().update(...args),
    deleteById: (...args) => getRepository().deleteById(...args),
}; 