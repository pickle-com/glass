const { doc, getDoc, setDoc, deleteDoc, writeBatch, query, where, getDocs, collection, Timestamp } = require('firebase/firestore');
const { getFirestoreInstance } = require('../../services/firebaseClient');
const { createEncryptedConverter } = require('../firestoreConverter');
const encryptionService = require('../../services/encryptionService');

const userConverter = createEncryptedConverter([]);

function usersCol() {
    const db = getFirestoreInstance();
    return collection(db, 'users').withConverter(userConverter);
}

// These functions are mostly correct as they already operate on a top-level collection.
// We just need to ensure the signatures are consistent.

async function findOrCreate(user) {
    if (!user || !user.uid) throw new Error('User object and uid are required');
    const { uid, displayName, email } = user;
    const now = Timestamp.now();
    const docRef = doc(usersCol(), uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        await setDoc(docRef, { 
            display_name: displayName || docSnap.data().display_name || 'User',
            email: email || docSnap.data().email || 'no-email@example.com'
        }, { merge: true });
    } else {
        await setDoc(docRef, { uid, display_name: displayName || 'User', email: email || 'no-email@example.com', created_at: now });
    }
    const finalDoc = await getDoc(docRef);
    return finalDoc.data();
}

async function getById(uid) {
    const docRef = doc(usersCol(), uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}



async function update({ uid, displayName }) {
    const docRef = doc(usersCol(), uid);
    await setDoc(docRef, { display_name: displayName }, { merge: true });
    return { changes: 1 };
}

async function deleteById(uid) {
    const db = getFirestoreInstance();
    const batch = writeBatch(db);

    // 1. Delete all sessions owned by the user
    const sessionsQuery = query(collection(db, 'sessions'), where('uid', '==', uid));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    for (const sessionDoc of sessionsSnapshot.docs) {
        // Recursively delete sub-collections
        const subcollectionsToDelete = ['transcripts', 'ai_messages', 'summary'];
        for (const sub of subcollectionsToDelete) {
            const subColPath = `sessions/${sessionDoc.id}/${sub}`;
            const subSnapshot = await getDocs(query(collection(db, subColPath)));
            subSnapshot.forEach(d => batch.delete(d.ref));
        }
        batch.delete(sessionDoc.ref);
    }

    // 2. Delete all presets owned by the user
    const presetsQuery = query(collection(db, 'prompt_presets'), where('uid', '==', uid));
    const presetsSnapshot = await getDocs(presetsQuery);
    presetsSnapshot.forEach(doc => batch.delete(doc.ref));

    // 3. Delete the user document itself
    const userRef = doc(usersCol(), uid);
    batch.delete(userRef);

    await batch.commit();
    return { success: true };
}

module.exports = {
    findOrCreate,
    getById,
    update,
    deleteById,
}; 