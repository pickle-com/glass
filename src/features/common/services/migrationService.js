const { doc, writeBatch, Timestamp } = require('firebase/firestore');
const { getFirestoreInstance } = require('../services/firebaseClient');
const encryptionService = require('../services/encryptionService');

const sqliteSessionRepo = require('../repositories/session/sqlite.repository');
const sqlitePresetRepo = require('../repositories/preset/sqlite.repository');
const sqliteUserRepo = require('../repositories/user/sqlite.repository');
const sqliteSttRepo = require('../../listen/stt/repositories/sqlite.repository');
const sqliteSummaryRepo = require('../../listen/summary/repositories/sqlite.repository');
const sqliteAiMessageRepo = require('../../ask/repositories/sqlite.repository');

const MAX_BATCH_OPERATIONS = 500;

async function checkAndRunMigration(firebaseUser) {
    if (!firebaseUser || !firebaseUser.uid) {
        console.log('[Migration] No user, skipping migration check.');
        return;
    }

    console.log(`[Migration] Checking for user ${firebaseUser.uid}...`);

    const localUser = sqliteUserRepo.getById(firebaseUser.uid);
    if (!localUser || localUser.has_migrated_to_firebase) {
        console.log(`[Migration] User ${firebaseUser.uid} is not eligible or already migrated.`);
        return;
    }

    console.log(`[Migration] Starting data migration for user ${firebaseUser.uid}...`);
    
    try {
        const db = getFirestoreInstance();
        
        // --- Phase 1: Migrate Parent Documents (Presets & Sessions) ---
        console.log('[Migration Phase 1] Migrating parent documents...');
        let phase1Batch = writeBatch(db);
        let phase1OpCount = 0;
        const phase1Promises = [];
        
        const localPresets = (await sqlitePresetRepo.getPresets(firebaseUser.uid)).filter(p => !p.is_default);
        console.log(`[Migration Phase 1] Found ${localPresets.length} custom presets.`);
        for (const preset of localPresets) {
            const presetRef = doc(db, 'prompt_presets', preset.id);
            const cleanPreset = {
                uid: preset.uid,
                title: encryptionService.encrypt(preset.title ?? ''),
                prompt: encryptionService.encrypt(preset.prompt ?? ''),
                is_default: preset.is_default ?? 0,
                created_at: preset.created_at ? Timestamp.fromMillis(preset.created_at * 1000) : null,
                updated_at: preset.updated_at ? Timestamp.fromMillis(preset.updated_at * 1000) : null
            };
            phase1Batch.set(presetRef, cleanPreset);
            phase1OpCount++;
            if (phase1OpCount >= MAX_BATCH_OPERATIONS) {
                phase1Promises.push(phase1Batch.commit());
                phase1Batch = writeBatch(db);
                phase1OpCount = 0;
            }
        }
        
        const localSessions = await sqliteSessionRepo.getAllByUserId(firebaseUser.uid);
        console.log(`[Migration Phase 1] Found ${localSessions.length} sessions.`);
        for (const session of localSessions) {
            const sessionRef = doc(db, 'sessions', session.id);
            const cleanSession = {
                uid: session.uid,
                members: session.members ?? [session.uid],
                title: encryptionService.encrypt(session.title ?? ''),
                session_type: session.session_type ?? 'ask',
                started_at: session.started_at ? Timestamp.fromMillis(session.started_at * 1000) : null,
                ended_at: session.ended_at ? Timestamp.fromMillis(session.ended_at * 1000) : null,
                updated_at: session.updated_at ? Timestamp.fromMillis(session.updated_at * 1000) : null
            };
            phase1Batch.set(sessionRef, cleanSession);
            phase1OpCount++;
            if (phase1OpCount >= MAX_BATCH_OPERATIONS) {
                phase1Promises.push(phase1Batch.commit());
                phase1Batch = writeBatch(db);
                phase1OpCount = 0;
            }
        }
        
        if (phase1OpCount > 0) {
            phase1Promises.push(phase1Batch.commit());
        }
        
        if (phase1Promises.length > 0) {
            await Promise.all(phase1Promises);
            console.log(`[Migration Phase 1] Successfully committed ${phase1Promises.length} batches of parent documents.`);
        } else {
            console.log('[Migration Phase 1] No parent documents to migrate.');
        }

        // --- Phase 2: Migrate Child Documents (sub-collections) ---
        console.log('[Migration Phase 2] Migrating child documents for all sessions...');
        let phase2Batch = writeBatch(db);
        let phase2OpCount = 0;
        const phase2Promises = [];

        for (const session of localSessions) {
            const transcripts = await sqliteSttRepo.getAllTranscriptsBySessionId(session.id);
            for (const t of transcripts) {
                const transcriptRef = doc(db, `sessions/${session.id}/transcripts`, t.id);
                const cleanTranscript = {
                    uid: firebaseUser.uid,
                    session_id: t.session_id,
                    start_at: t.start_at ? Timestamp.fromMillis(t.start_at * 1000) : null,
                    end_at: t.end_at ? Timestamp.fromMillis(t.end_at * 1000) : null,
                    speaker: t.speaker ?? null,
                    text: encryptionService.encrypt(t.text ?? ''),
                    lang: t.lang ?? 'en',
                    created_at: t.created_at ? Timestamp.fromMillis(t.created_at * 1000) : null
                };
                phase2Batch.set(transcriptRef, cleanTranscript);
                phase2OpCount++;
                if (phase2OpCount >= MAX_BATCH_OPERATIONS) {
                    phase2Promises.push(phase2Batch.commit());
                    phase2Batch = writeBatch(db);
                    phase2OpCount = 0;
                }
            }

            const messages = await sqliteAiMessageRepo.getAllAiMessagesBySessionId(session.id);
            for (const m of messages) {
                const msgRef = doc(db, `sessions/${session.id}/ai_messages`, m.id);
                const cleanMessage = {
                    uid: firebaseUser.uid,
                    session_id: m.session_id,
                    sent_at: m.sent_at ? Timestamp.fromMillis(m.sent_at * 1000) : null,
                    role: m.role ?? 'user',
                    content: encryptionService.encrypt(m.content ?? ''),
                    tokens: m.tokens ?? null,
                    model: m.model ?? 'unknown',
                    created_at: m.created_at ? Timestamp.fromMillis(m.created_at * 1000) : null
                };
                phase2Batch.set(msgRef, cleanMessage);
                phase2OpCount++;
                if (phase2OpCount >= MAX_BATCH_OPERATIONS) {
                    phase2Promises.push(phase2Batch.commit());
                    phase2Batch = writeBatch(db);
                    phase2OpCount = 0;
                }
            }

            const summary = await sqliteSummaryRepo.getSummaryBySessionId(session.id);
            if (summary) {
                // Reverting to use 'data' as the document ID for summary.
                const summaryRef = doc(db, `sessions/${session.id}/summary`, 'data');
                const cleanSummary = {
                    uid: firebaseUser.uid,
                    session_id: summary.session_id,
                    generated_at: summary.generated_at ? Timestamp.fromMillis(summary.generated_at * 1000) : null,
                    model: summary.model ?? 'unknown',
                    tldr: encryptionService.encrypt(summary.tldr ?? ''),
                    text: encryptionService.encrypt(summary.text ?? ''),
                    bullet_json: encryptionService.encrypt(summary.bullet_json ?? '[]'),
                    action_json: encryptionService.encrypt(summary.action_json ?? '[]'),
                    tokens_used: summary.tokens_used ?? null,
                    updated_at: summary.updated_at ? Timestamp.fromMillis(summary.updated_at * 1000) : null
                };
                phase2Batch.set(summaryRef, cleanSummary);
                phase2OpCount++;
                if (phase2OpCount >= MAX_BATCH_OPERATIONS) {
                    phase2Promises.push(phase2Batch.commit());
                    phase2Batch = writeBatch(db);
                    phase2OpCount = 0;
                }
            }
        }

        if (phase2OpCount > 0) {
            phase2Promises.push(phase2Batch.commit());
        }

        if (phase2Promises.length > 0) {
            await Promise.all(phase2Promises);
            console.log(`[Migration Phase 2] Successfully committed ${phase2Promises.length} batches of child documents.`);
        } else {
            console.log('[Migration Phase 2] No child documents to migrate.');
        }

        // --- 4. Mark migration as complete ---
        sqliteUserRepo.setMigrationComplete(firebaseUser.uid);
        console.log(`[Migration] ✅ Successfully marked migration as complete for ${firebaseUser.uid}.`);

    } catch (error) {
        console.error(`[Migration] 🔥 An error occurred during migration for user ${firebaseUser.uid}:`, error);
    }
}

module.exports = {
    checkAndRunMigration,
}; 