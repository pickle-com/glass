const encryptionService = require('../services/encryptionService');
const { Timestamp } = require('firebase/firestore');

/**
 * Creates a Firestore converter that automatically encrypts and decrypts specified fields.
 * @param {string[]} fieldsToEncrypt - An array of field names to encrypt.
 * @returns {import('@firebase/firestore').FirestoreDataConverter<T>} A Firestore converter.
 * @template T
 */
function createEncryptedConverter(fieldsToEncrypt = []) {
    return {
        /**
         * @param {import('@firebase/firestore').DocumentData} appObject
         */
        toFirestore: (appObject) => {
            const firestoreData = { ...appObject };
            for (const field of fieldsToEncrypt) {
                if (Object.prototype.hasOwnProperty.call(firestoreData, field) && firestoreData[field] != null) {
                    firestoreData[field] = encryptionService.encrypt(firestoreData[field]);
                }
            }
            // Ensure there's a timestamp for the last modification
            firestoreData.updated_at = Timestamp.now();
            return firestoreData;
        },
        /**
         * @param {import('@firebase/firestore').QueryDocumentSnapshot} snapshot
         * @param {import('@firebase/firestore').SnapshotOptions} options
         */
        fromFirestore: (snapshot, options) => {
            const firestoreData = snapshot.data(options);
            const appObject = { ...firestoreData, id: snapshot.id }; // include the document ID

            for (const field of fieldsToEncrypt) {
                 if (Object.prototype.hasOwnProperty.call(appObject, field) && appObject[field] != null) {
                    try {
                        appObject[field] = encryptionService.decrypt(appObject[field]);
                    } catch (error) {
                        console.warn(`[FirestoreConverter] Failed to decrypt field '${field}' (possibly plaintext or key mismatch):`, error.message);
                        // Keep the original value instead of failing
                        // appObject[field] remains as is
                    }
                }
            }

            // Convert Firestore Timestamps back to Unix timestamps (seconds) for app-wide consistency
            for (const key in appObject) {
                if (appObject[key] instanceof Timestamp) {
                    appObject[key] = appObject[key].seconds;
                }
            }
            
            return appObject;
        }
    };
}

module.exports = {
    createEncryptedConverter,
}; 