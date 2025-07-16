const { initializeApp } = require('firebase/app');
const { initializeAuth } = require('firebase/auth');
const Store = require('electron-store');
const { getFirestore, setLogLevel } = require('firebase/firestore');

// setLogLevel('debug');

/**
 * Firebase Auth expects the `persistence` option passed to `initializeAuth()` to be *classes*,
 * not instances. It then calls `new PersistenceClass()` internally.  
 *
 * The helper below returns such a class, pre-configured with an `electron-store` instance that
 * will be shared across all constructed objects. This mirrors the pattern used by Firebase's own
 * `browserLocalPersistence` implementation as well as community solutions for NodeJS.
 */
function createElectronStorePersistence(storeName = 'firebase-auth-session') {
    // Create a single `electron-store` behind the scenes – all Persistence instances will use it.
    const sharedStore = new Store({ name: storeName });

    return class ElectronStorePersistence {
        constructor() {
            this.store = sharedStore;
            this.type = 'LOCAL';
        }

        /**
         * Firebase calls this to check whether the persistence is usable in the current context.
         */
        _isAvailable() {
            return Promise.resolve(true);
        }

        async _set(key, value) {
            this.store.set(key, value);
        }

        async _get(key) {
            return this.store.get(key) ?? null;
        }

        async _remove(key) {
            this.store.delete(key);
        }

        /**
         * These are used by Firebase to react to external storage events (e.g. multi-tab).
         * Electron apps are single-renderer per process, so we can safely provide no-op
         * implementations.
         */
        _addListener(_key, _listener) {
            // no-op
        }

        _removeListener(_key, _listener) {
            // no-op
        }
    };
}

const firebaseConfig = {
    apiKey: 'AIzaSyAgtJrmsFWG1C7m9S55HyT1laICEzuUS2g',
    authDomain: 'pickle-3651a.firebaseapp.com',
    projectId: 'pickle-3651a',
    storageBucket: 'pickle-3651a.firebasestorage.app',
    messagingSenderId: '904706892885',
    appId: '1:904706892885:web:0e42b3dda796674ead20dc',
    measurementId: 'G-SQ0WM6S28T',
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreInstance = null; // To hold the specific DB instance

function initializeFirebase() {
    if (firebaseApp) {
        console.log('[FirebaseClient] Firebase already initialized.');
        return;
    }
    try {
        firebaseApp = initializeApp(firebaseConfig);
        
        // Build a *class* persistence provider and hand it to Firebase.
        const ElectronStorePersistence = createElectronStorePersistence('firebase-auth-session');

        firebaseAuth = initializeAuth(firebaseApp, {
            // `initializeAuth` accepts a single class or an array – we pass an array for future
            // extensibility and to match Firebase examples.
            persistence: [ElectronStorePersistence],
        });

        // Initialize Firestore with the specific database ID
        firestoreInstance = getFirestore(firebaseApp, 'pickle-glass');

        console.log('[FirebaseClient] Firebase initialized successfully with class-based electron-store persistence.');
        console.log('[FirebaseClient] Firestore instance is targeting the "pickle-glass" database.');
    } catch (error) {
        console.error('[FirebaseClient] Firebase initialization failed:', error);
    }
}

function getFirebaseAuth() {
    if (!firebaseAuth) {
        throw new Error("Firebase Auth has not been initialized. Call initializeFirebase() first.");
    }
    return firebaseAuth;
}

function getFirestoreInstance() {
    if (!firestoreInstance) {
        throw new Error("Firestore has not been initialized. Call initializeFirebase() first.");
    }
    return firestoreInstance;
}

module.exports = {
    initializeFirebase,
    getFirebaseAuth,
    getFirestoreInstance,
}; 