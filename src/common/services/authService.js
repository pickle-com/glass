const { onAuthStateChanged, signInWithCustomToken, signOut } = require('firebase/auth');
const { BrowserWindow } = require('electron');
const { getFirebaseAuth } = require('./firebaseClient');
const userRepository = require('../repositories/user');
const fetch = require('node-fetch');

async function getVirtualKeyByEmail(email, idToken) {
    if (!idToken) {
        throw new Error('Firebase ID token is required for virtual key request');
    }

    const resp = await fetch('https://serverless-api-sf3o.vercel.app/api/virtual_key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        redirect: 'follow',
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        console.error('[VK] API request failed:', json.message || 'Unknown error');
        throw new Error(json.message || `HTTP ${resp.status}: Virtual key request failed`);
    }

    const vKey = json?.data?.virtualKey || json?.data?.virtual_key || json?.data?.newVKey?.slug;

    if (!vKey) throw new Error('virtual key missing in response');
    return vKey;
}

class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local'; // 'local' or 'firebase'
        this.currentUser = null;
        this.hasApiKey = false; // Add a flag for API key status
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        const auth = getFirebaseAuth();
        onAuthStateChanged(auth, async (user) => {
            const previousUser = this.currentUser;

            if (user) {
                // User signed IN
                console.log(`[AuthService] Firebase user signed in:`, user.uid);
                this.currentUser = user;
                this.currentUserId = user.uid;
                this.currentUserMode = 'firebase';
                this.hasApiKey = false; // Optimistically assume no key yet

                // Broadcast immediately to make UI feel responsive
                this.broadcastUserState();

                // Start background task to fetch and save virtual key
                (async () => {
                    try {
                        const idToken = await user.getIdToken(true);
                        const virtualKey = await getVirtualKeyByEmail(user.email, idToken);
                        await userRepository.saveApiKey(virtualKey, user.uid, 'openai');
                        console.log(`[AuthService] BG: Virtual key for ${user.email} has been saved.`);
                        // Now update the key status, which will trigger another broadcast
                        await this.updateApiKeyStatus();
                    } catch (error) {
                        console.error('[AuthService] BG: Failed to fetch or save virtual key:', error);
                    }
                })();

            } else {
                // User signed OUT
                console.log(`[AuthService] Firebase user signed out.`);
                if (previousUser) {
                    console.log(`[AuthService] Clearing API key for logged-out user: ${previousUser.uid}`);
                    await userRepository.saveApiKey(null, previousUser.uid);
                }
                this.currentUser = null;
                this.currentUserId = 'default_user';
                this.currentUserMode = 'local';
                // Update API key status (e.g., if a local key for default_user exists)
                // This will also broadcast the final logged-out state.
                await this.updateApiKeyStatus();
            }
        });

        // Check for initial API key state
        this.updateApiKeyStatus();
        
        this.isInitialized = true;
        console.log('[AuthService] Initialized and attached to Firebase Auth state.');
    }

    async signInWithCustomToken(token) {
        const auth = getFirebaseAuth();
        try {
            const userCredential = await signInWithCustomToken(auth, token);
            console.log(`[AuthService] Successfully signed in with custom token for user:`, userCredential.user.uid);
            // onAuthStateChanged will handle the state update and broadcast
        } catch (error) {
            console.error('[AuthService] Error signing in with custom token:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    async signOut() {
        const auth = getFirebaseAuth();
        try {
            await signOut(auth);
            console.log('[AuthService] User sign-out initiated successfully.');
            // onAuthStateChanged will handle the state update and broadcast,
            // which will also re-evaluate the API key status.
        } catch (error) {
            console.error('[AuthService] Error signing out:', error);
        }
    }
    
    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state change:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    /**
     * Updates the internal API key status from the repository and broadcasts if changed.
     */
    async updateApiKeyStatus() {
        try {
            const user = await userRepository.getById(this.currentUserId);
            const newStatus = !!(user && user.api_key);
            if (this.hasApiKey !== newStatus) {
                console.log(`[AuthService] API key status changed to: ${newStatus}`);
                this.hasApiKey = newStatus;
                this.broadcastUserState();
            }
        } catch (error) {
            console.error('[AuthService] Error checking API key status:', error);
            this.hasApiKey = false;
        }
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        const isLoggedIn = !!(this.currentUserMode === 'firebase' && this.currentUser);

        if (isLoggedIn) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                mode: 'firebase',
                isLoggedIn: true,
                hasApiKey: this.hasApiKey // Always true for firebase users, but good practice
            };
        }
        return {
            uid: this.currentUserId, // returns 'default_user'
            email: 'contact@pickle.com',
            displayName: 'Default User',
            mode: 'local',
            isLoggedIn: false,
            hasApiKey: this.hasApiKey
        };
    }
}

const authService = new AuthService();
module.exports = authService; 