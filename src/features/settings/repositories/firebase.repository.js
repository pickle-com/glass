const { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy } = require('firebase/firestore');
const { getFirestoreInstance } = require('../../common/services/firebaseClient');
const { createEncryptedConverter } = require('../../common/repositories/firestoreConverter');
const encryptionService = require('../../common/services/encryptionService');

const userPresetConverter = createEncryptedConverter(['prompt', 'title']);

const defaultPresetConverter = {
    toFirestore: (data) => data,
    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return { ...data, id: snapshot.id };
    }
};

function userPresetsCol() {
    const db = getFirestoreInstance();
    return collection(db, 'prompt_presets').withConverter(userPresetConverter);
}

function defaultPresetsCol() {
    const db = getFirestoreInstance();
    return collection(db, 'defaults/v1/prompt_presets').withConverter(defaultPresetConverter);
}

async function getPresets(uid) {
    const userPresetsQuery = query(userPresetsCol(), where('uid', '==', uid));
    const defaultPresetsQuery = query(defaultPresetsCol());

    const [userSnapshot, defaultSnapshot] = await Promise.all([
        getDocs(userPresetsQuery),
        getDocs(defaultPresetsQuery)
    ]);

    const presets = [
        ...defaultSnapshot.docs.map(d => d.data()),
        ...userSnapshot.docs.map(d => d.data())
    ];

    return presets.sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return a.title.localeCompare(b.title);
    });
}

async function getPresetTemplates() {
    const q = query(defaultPresetsCol(), orderBy('title', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
}

async function createPreset({ uid, title, prompt }) {
    const now = Math.floor(Date.now() / 1000);
    const newPreset = {
        uid: uid,
        title,
        prompt,
        is_default: 0,
        created_at: now,
    };
    const docRef = await addDoc(userPresetsCol(), newPreset);
    return { id: docRef.id };
}

async function updatePreset(id, { title, prompt }, uid) {
    const docRef = doc(userPresetsCol(), id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().uid !== uid || docSnap.data().is_default) {
        throw new Error("Preset not found or permission denied to update.");
    }

    const updates = {};
    if (title !== undefined) {
        updates.title = encryptionService.encrypt(title);
    }
    if (prompt !== undefined) {
        updates.prompt = encryptionService.encrypt(prompt);
    }
    updates.updated_at = Math.floor(Date.now() / 1000);
    
    await updateDoc(docRef, updates);
    return { changes: 1 };
}

async function deletePreset(id, uid) {
    const docRef = doc(userPresetsCol(), id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().uid !== uid || docSnap.data().is_default) {
        throw new Error("Preset not found or permission denied to delete.");
    }

    await deleteDoc(docRef);
    return { changes: 1 };
}

async function getAutoUpdate(uid) {
    // Assume users are stored in a "users" collection, and auto_update_enabled is a field
    const userDocRef = doc(getFirestoreInstance(), 'users', uid);
    try {
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (typeof data.auto_update_enabled !== 'undefined') {
                console.log('Firebase: Auto update setting found:', data.auto_update_enabled);
                return !!data.auto_update_enabled;
            } else {
                // Field does not exist, just return default
                return true;
            }
        } else {
            // User doc does not exist, just return default
            return true;
        }
    } catch (error) {
        console.error('Firebase: Error getting auto_update_enabled setting:', error);
        return true; // fallback to enabled
    }
}

async function setAutoUpdate(uid, isEnabled) {
    const userDocRef = doc(getFirestoreInstance(), 'users', uid);
    try {
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            await updateDoc(userDocRef, { auto_update_enabled: !!isEnabled });
        }
        // If user doc does not exist, do nothing (no creation)
        return { success: true };
    } catch (error) {
        console.error('Firebase: Error setting auto-update:', error);
        return { success: false, error: error.message };
    }
}



module.exports = {
    getPresets,
    getPresetTemplates,
    createPreset,
    updatePreset,
    deletePreset,
    getAutoUpdate,
    setAutoUpdate,
}; 