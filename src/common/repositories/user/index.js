const sqliteRepository = require('./sqlite.repository');
const firebaseRepository = require('./firebase.repository');

let authService = null;

function setAuthService(service) {
    authService = service;
}

function getBaseRepository() {
    if (!authService) {
        throw new Error('AuthService has not been set for the user repository.');
    }
    const user = authService.getCurrentUser();
    if (user && user.isLoggedIn) {
        return firebaseRepository;
    }
    return sqliteRepository;
}

const userRepositoryAdapter = {
    findOrCreate: (user) => {
        // This function receives the full user object, which includes the uid. No need to inject.
        return getBaseRepository().findOrCreate(user);
    },
    
    getById: () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().getById(uid);
    },



    update: (updateData) => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().update({ uid, ...updateData });
    },

    deleteById: () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().deleteById(uid);
    }
};

module.exports = {
    ...userRepositoryAdapter,
    setAuthService
}; 