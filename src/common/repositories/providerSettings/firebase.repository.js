const { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } = require('firebase/firestore');
const { getFirestoreInstance: getFirestore } = require('../../services/firebaseClient');
const { createEncryptedConverter } = require('../firestoreConverter');

// Create encrypted converter for provider settings
const providerSettingsConverter = createEncryptedConverter([
    'api_key', // Encrypt API keys
    'selected_llm_model', // Encrypt model selections for privacy
    'selected_stt_model'
]);

function providerSettingsCol() {
    const db = getFirestore();
    return collection(db, 'provider_settings').withConverter(providerSettingsConverter);
}

async function getByProvider(uid, provider) {
    try {
        const docRef = doc(providerSettingsCol(), `${uid}_${provider}`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error('[ProviderSettings Firebase] Error getting provider settings:', error);
        return null;
    }
}

async function getAllByUid(uid) {
    try {
        const q = query(providerSettingsCol(), where('uid', '==', uid));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('[ProviderSettings Firebase] Error getting all provider settings:', error);
        return [];
    }
}

async function upsert(uid, provider, settings) {
    try {
        const docRef = doc(providerSettingsCol(), `${uid}_${provider}`);
        await setDoc(docRef, settings, { merge: true });
        return { changes: 1 };
    } catch (error) {
        console.error('[ProviderSettings Firebase] Error upserting provider settings:', error);
        throw error;
    }
}

async function remove(uid, provider) {
    try {
        const docRef = doc(providerSettingsCol(), `${uid}_${provider}`);
        await deleteDoc(docRef);
        return { changes: 1 };
    } catch (error) {
        console.error('[ProviderSettings Firebase] Error removing provider settings:', error);
        throw error;
    }
}

async function removeAllByUid(uid) {
    try {
        const settings = await getAllByUid(uid);
        const deletePromises = settings.map(setting => {
            const docRef = doc(providerSettingsCol(), setting.id);
            return deleteDoc(docRef);
        });
        
        await Promise.all(deletePromises);
        return { changes: settings.length };
    } catch (error) {
        console.error('[ProviderSettings Firebase] Error removing all provider settings:', error);
        throw error;
    }
}

module.exports = {
    getByProvider,
    getAllByUid,
    upsert,
    remove,
    removeAllByUid
}; 