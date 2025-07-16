const crypto = require('crypto');
let keytar;

// Dynamically import keytar, as it's an optional dependency.
try {
    keytar = require('keytar');
} catch (error) {
    console.warn('[EncryptionService] keytar is not available. Will use in-memory key for this session. Restarting the app might be required for data persistence after login.');
    keytar = null;
}

const permissionService = require('./permissionService');

const SERVICE_NAME = 'com.pickle.glass'; // A unique identifier for the app in the keychain
let sessionKey = null; // In-memory fallback key

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const AUTH_TAG_LENGTH = 16;


/**
 * Initializes the encryption key for a given user.
 * It first tries to get the key from the OS keychain.
 * If that fails, it generates a new key.
 * If keytar is available, it saves the new key.
 * Otherwise, it uses an in-memory key for the session.
 *
 * @param {string} userId - The unique identifier for the user (e.g., Firebase UID).
 */
async function initializeKey(userId) {
    if (!userId) {
        throw new Error('A user ID must be provided to initialize the encryption key.');
    }

    let keyRetrieved = false;

    if (keytar) {
        try {
            let key = await keytar.getPassword(SERVICE_NAME, userId);
            if (!key) {
                console.log(`[EncryptionService] No key found for ${userId}. Creating a new one.`);
                key = crypto.randomBytes(32).toString('hex');
                await keytar.setPassword(SERVICE_NAME, userId, key);
                console.log(`[EncryptionService] New key securely stored in keychain for ${userId}.`);
            } else {
                console.log(`[EncryptionService] Encryption key successfully retrieved from keychain for ${userId}.`);
                keyRetrieved = true;
            }
            sessionKey = key;
        } catch (error) {
            console.error('[EncryptionService] keytar failed. Falling back to in-memory key for this session.', error);
            keytar = null; // Disable keytar for the rest of the session to avoid repeated errors
            sessionKey = crypto.randomBytes(32).toString('hex');
        }
    } else {
        // keytar is not available
        if (!sessionKey) {
            console.warn('[EncryptionService] Using in-memory session key. Data will not persist across restarts without keytar.');
            sessionKey = crypto.randomBytes(32).toString('hex');
        }
    }

    // Mark keychain completed in permissions DB if this is the first successful retrieval or storage
    try {
        await permissionService.markKeychainCompleted(userId);
        if (keyRetrieved) {
            console.log(`[EncryptionService] Keychain completion marked in DB for ${userId}.`);
        }
    } catch (permErr) {
        console.error('[EncryptionService] Failed to mark keychain completion:', permErr);
    }

    if (!sessionKey) {
        throw new Error('Failed to initialize encryption key.');
    }
}

function resetSessionKey() {
    sessionKey = null;
}

/**
 * Encrypts a given text using AES-256-GCM.
 * @param {string} text The text to encrypt.
 * @returns {string | null} The encrypted data, as a base64 string containing iv, authTag, and content, or the original value if it cannot be encrypted.
 */
function encrypt(text) {
    if (!sessionKey) {
        console.error('[EncryptionService] Encryption key is not initialized. Cannot encrypt.');
        return text; // Return original if key is missing
    }
    if (text == null) { // checks for null or undefined
        return text;
    }

    try {
        const key = Buffer.from(sessionKey, 'hex');
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(String(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();

        // Prepend IV and AuthTag to the encrypted content, then encode as base64.
        return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
    } catch (error) {
        console.error('[EncryptionService] Encryption failed:', error);
        return text; // Return original on error
    }
}

/**
 * Decrypts a given encrypted string.
 * @param {string} encryptedText The base64 encrypted text.
 * @returns {string | null} The decrypted text, or the original value if it cannot be decrypted.
 */
function decrypt(encryptedText) {
    if (!sessionKey) {
        console.error('[EncryptionService] Encryption key is not initialized. Cannot decrypt.');
        return encryptedText; // Return original if key is missing
    }
    if (encryptedText == null || typeof encryptedText !== 'string') {
        return encryptedText;
    }

    try {
        const data = Buffer.from(encryptedText, 'base64');
        if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
            // This is not a valid encrypted string, likely plain text.
            return encryptedText;
        }
        
        const key = Buffer.from(sessionKey, 'hex');
        const iv = data.slice(0, IV_LENGTH);
        const authTag = data.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encryptedContent = data.slice(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // It's common for this to fail if the data is not encrypted (e.g., legacy data).
        // In that case, we return the original value.
        console.error('[EncryptionService] Decryption failed:', error);
        return encryptedText;
    }
}

function looksEncrypted(str) {
    if (!str || typeof str !== 'string') return false;
    // Base64 chars + optional '=' padding
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
    try {
        const buf = Buffer.from(str, 'base64');
        // Our AES-GCM cipher text must be at least 32 bytes (IV 16 + TAG 16)
        return buf.length >= 32;
    } catch {
        return false;
    }
}

module.exports = {
    initializeKey,
    resetSessionKey,
    encrypt,
    decrypt,
    looksEncrypted,
}; 