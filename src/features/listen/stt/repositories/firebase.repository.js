const { collection, addDoc, query, getDocs, orderBy, Timestamp } = require('firebase/firestore');
const { getFirestoreInstance } = require('../../../common/services/firebaseClient');
const { createEncryptedConverter } = require('../../../common/repositories/firestoreConverter');

const transcriptConverter = createEncryptedConverter(['text']);

function transcriptsCol(sessionId) {
    if (!sessionId) throw new Error("Session ID is required to access transcripts.");
    const db = getFirestoreInstance();
    return collection(db, `sessions/${sessionId}/transcripts`).withConverter(transcriptConverter);
}

async function addTranscript({ uid, sessionId, speaker, text }) {
    const now = Timestamp.now();
    const newTranscript = {
        uid, // To identify the author/source of the transcript
        session_id: sessionId,
        start_at: now,
        speaker,
        text,
        created_at: now,
    };
    const docRef = await addDoc(transcriptsCol(sessionId), newTranscript);
    return { id: docRef.id };
}

async function getAllTranscriptsBySessionId(sessionId) {
    const q = query(transcriptsCol(sessionId), orderBy('start_at', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
}

module.exports = {
    addTranscript,
    getAllTranscriptsBySessionId,
}; 