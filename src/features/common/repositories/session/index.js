const sqliteRepository = require('./sqlite.repository');
const firebaseRepository = require('./firebase.repository');

let authService = null;

function setAuthService(service) {
    authService = service;
}

function getBaseRepository() {
    if (!authService) {
        // Fallback or error if authService is not set, to prevent crashes.
        // During initial load, it might not be set, so we default to sqlite.
        return sqliteRepository;
    }
    const user = authService.getCurrentUser();
    if (user && user.isLoggedIn) {
        return firebaseRepository;
    }
    return sqliteRepository;
}

// The adapter layer that injects the UID
const sessionRepositoryAdapter = {
    setAuthService, // Expose the setter

    getById: (id) => getBaseRepository().getById(id),
    
    create: (type = 'ask') => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().create(uid, type);
    },
    
    getAllByUserId: () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().getAllByUserId(uid);
    },

    updateTitle: (id, title) => getBaseRepository().updateTitle(id, title),
    
    deleteWithRelatedData: (id) => getBaseRepository().deleteWithRelatedData(id),

    end: (id) => getBaseRepository().end(id),

    updateType: (id, type) => getBaseRepository().updateType(id, type),

    touch: (id) => getBaseRepository().touch(id),

    getOrCreateActive: (requestedType = 'ask') => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().getOrCreateActive(uid, requestedType);
    },

    endAllActiveSessions: () => {
        const uid = authService.getCurrentUserId();
        return getBaseRepository().endAllActiveSessions(uid);
    },
};

module.exports = sessionRepositoryAdapter; 