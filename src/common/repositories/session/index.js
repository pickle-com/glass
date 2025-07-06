const sqliteRepository = require('./sqlite.repository');
// const firebaseRepository = require('./firebase.repository'); // Future implementation
const authService = require('../../../common/services/authService');

function getRepository() {
    // In the future, we can check the user's login status from authService
    // const user = authService.getCurrentUser();
    // if (user.isLoggedIn) {
    //     return firebaseRepository;
    // }
    return sqliteRepository;
}

// Directly export functions for ease of use, decided by the strategy
module.exports = {
    getById: (...args) => getRepository().getById(...args),
    create: (...args) => getRepository().create(...args),
    getAllByUserId: (...args) => getRepository().getAllByUserId(...args),
    updateTitle: (...args) => getRepository().updateTitle(...args),
    deleteWithRelatedData: (...args) => getRepository().deleteWithRelatedData(...args),
    end: (...args) => getRepository().end(...args),
    updateType: (...args) => getRepository().updateType(...args),
    touch: (...args) => getRepository().touch(...args),
    getOrCreateActive: (...args) => getRepository().getOrCreateActive(...args),
    endAllActiveSessions: (...args) => getRepository().endAllActiveSessions(...args),
}; 