const { collection, doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
const { getFirestoreInstance: getFirestore } = require('../../services/firebaseClient');
const { createEncryptedConverter } = require('../firestoreConverter');

// Create encrypted converter for user model selections
const userModelSelectionsConverter = createEncryptedConverter([
    'selected_llm_provider',
    'selected_llm_model',
    'selected_stt_provider', 
    'selected_stt_model'
]);

function userModelSelectionsCol() {
    const db = getFirestore();
    return collection(db, 'user_model_selections').withConverter(userModelSelectionsConverter);
}

async function get(uid) {
    try {
        const docRef = doc(userModelSelectionsCol(), uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error('[UserModelSelections Firebase] Error getting user model selections:', error);
        return null;
    }
}

async function upsert(uid, selections) {
    try {
        const docRef = doc(userModelSelectionsCol(), uid);
        await setDoc(docRef, selections, { merge: true });
        return { changes: 1 };
    } catch (error) {
        console.error('[UserModelSelections Firebase] Error upserting user model selections:', error);
        throw error;
    }
}

async function remove(uid) {
    try {
        const docRef = doc(userModelSelectionsCol(), uid);
        await deleteDoc(docRef);
        return { changes: 1 };
    } catch (error) {
        console.error('[UserModelSelections Firebase] Error removing user model selections:', error);
        throw error;
    }
}

module.exports = {
    get,
    upsert,
    remove
}; 