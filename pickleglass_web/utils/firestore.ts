import { 
  doc, 
  collection, 
  addDoc,
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './firebase';

export interface FirestoreUserProfile {
  displayName: string;
  email: string;
  createdAt: Timestamp;
}

export interface FirestoreSession {
  title: string;
  session_type: string;
  startedAt: Timestamp;
  endedAt?: Timestamp;
}

export interface FirestoreTranscript {
  startAt: Timestamp;
  endAt: Timestamp;
  speaker: 'me' | 'other';
  text: string;
  lang?: string;
  createdAt: Timestamp;
}

export interface FirestoreAiMessage {
  sentAt: Timestamp;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  model?: string;
  createdAt: Timestamp;
}

export interface FirestoreSummary {
  generatedAt: Timestamp;
  model: string;
  text: string;
  tldr: string;
  bulletPoints: string[];
  actionItems: Array<{ owner: string; task: string; due: string }>;
  tokensUsed?: number;
}

export interface FirestorePromptPreset {
  title: string;
  prompt: string;
  isDefault: boolean;
  createdAt: Timestamp;
}

export class FirestoreUserService {
  static async createUser(uid: string, profile: Omit<FirestoreUserProfile, 'createdAt'>) {
    const userRef = doc(firestore, 'users', uid);
    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp()
    });
  }

  static async getUser(uid: string): Promise<FirestoreUserProfile | null> {
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() as FirestoreUserProfile : null;
  }

  static async updateUser(uid: string, updates: Partial<FirestoreUserProfile>) {
    const userRef = doc(firestore, 'users', uid);
    await updateDoc(userRef, updates);
  }

  static async deleteUser(uid: string) {
    const batch = writeBatch(firestore);
    
    const sessionsRef = collection(firestore, 'users', uid, 'sessions');
    const sessionsSnap = await getDocs(sessionsRef);
    
    for (const sessionDoc of sessionsSnap.docs) {
      const sessionId = sessionDoc.id;
      
      const transcriptsRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'transcripts');
      const transcriptsSnap = await getDocs(transcriptsRef);
      transcriptsSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      const aiMessagesRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'aiMessages');
      const aiMessagesSnap = await getDocs(aiMessagesRef);
      aiMessagesSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      const summaryRef = doc(firestore, 'users', uid, 'sessions', sessionId, 'summary', 'data');
      batch.delete(summaryRef);
      
      batch.delete(sessionDoc.ref);
    }
    
    const presetsRef = collection(firestore, 'users', uid, 'promptPresets');
    const presetsSnap = await getDocs(presetsRef);
    presetsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    const userRef = doc(firestore, 'users', uid);
    batch.delete(userRef);
    
    await batch.commit();
  }
}

export class FirestoreSessionService {
  static async createSession(uid: string, session: Omit<FirestoreSession, 'startedAt'>): Promise<string> {
    const sessionsRef = collection(firestore, 'users', uid, 'sessions');
    const docRef = await addDoc(sessionsRef, {
      ...session,
      startedAt: serverTimestamp()
    });
    return docRef.id;
  }

  static async getSession(uid: string, sessionId: string): Promise<FirestoreSession | null> {
    const sessionRef = doc(firestore, 'users', uid, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    return sessionSnap.exists() ? sessionSnap.data() as FirestoreSession : null;
  }

  static async getSessions(uid: string): Promise<Array<{ id: string } & FirestoreSession>> {
    const sessionsRef = collection(firestore, 'users', uid, 'sessions');
    const q = query(sessionsRef, orderBy('startedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as FirestoreSession
    }));
  }

  static async updateSession(uid: string, sessionId: string, updates: Partial<FirestoreSession>) {
    const sessionRef = doc(firestore, 'users', uid, 'sessions', sessionId);
    await updateDoc(sessionRef, updates);
  }

  static async deleteSession(uid: string, sessionId: string) {
    const batch = writeBatch(firestore);
    
    const transcriptsRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'transcripts');
    const transcriptsSnap = await getDocs(transcriptsRef);
    transcriptsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    const aiMessagesRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'aiMessages');
    const aiMessagesSnap = await getDocs(aiMessagesRef);
    aiMessagesSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    const summaryRef = doc(firestore, 'users', uid, 'sessions', sessionId, 'summary', 'data');
    batch.delete(summaryRef);
    
    const sessionRef = doc(firestore, 'users', uid, 'sessions', sessionId);
    batch.delete(sessionRef);
    
    await batch.commit();
  }
}

export class FirestoreTranscriptService {
  static async addTranscript(uid: string, sessionId: string, transcript: Omit<FirestoreTranscript, 'createdAt'>): Promise<string> {
    const transcriptsRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'transcripts');
    const docRef = await addDoc(transcriptsRef, {
      ...transcript,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  static async getTranscripts(uid: string, sessionId: string): Promise<Array<{ id: string } & FirestoreTranscript>> {
    const transcriptsRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'transcripts');
    const q = query(transcriptsRef, orderBy('startAt', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as FirestoreTranscript
    }));
  }
}

export class FirestoreAiMessageService {
  static async addAiMessage(uid: string, sessionId: string, message: Omit<FirestoreAiMessage, 'createdAt'>): Promise<string> {
    const aiMessagesRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'aiMessages');
    const docRef = await addDoc(aiMessagesRef, {
      ...message,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  static async getAiMessages(uid: string, sessionId: string): Promise<Array<{ id: string } & FirestoreAiMessage>> {
    const aiMessagesRef = collection(firestore, 'users', uid, 'sessions', sessionId, 'aiMessages');
    const q = query(aiMessagesRef, orderBy('sentAt', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as FirestoreAiMessage
    }));
  }
}

export class FirestoreSummaryService {
  static async setSummary(uid: string, sessionId: string, summary: FirestoreSummary) {
    const summaryRef = doc(firestore, 'users', uid, 'sessions', sessionId, 'summary', 'data');
    await setDoc(summaryRef, summary);
  }

  static async getSummary(uid: string, sessionId: string): Promise<FirestoreSummary | null> {
    const summaryRef = doc(firestore, 'users', uid, 'sessions', sessionId, 'summary', 'data');
    const summarySnap = await getDoc(summaryRef);
    return summarySnap.exists() ? summarySnap.data() as FirestoreSummary : null;
  }
}

export class FirestorePromptPresetService {
  static async createPreset(uid: string, preset: Omit<FirestorePromptPreset, 'createdAt'>): Promise<string> {
    const presetsRef = collection(firestore, 'users', uid, 'promptPresets');
    const docRef = await addDoc(presetsRef, {
      ...preset,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  static async getPresets(uid: string): Promise<Array<{ id: string } & FirestorePromptPreset>> {
    const presetsRef = collection(firestore, 'users', uid, 'promptPresets');
    const q = query(presetsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as FirestorePromptPreset
    }));
  }

  static async updatePreset(uid: string, presetId: string, updates: Partial<FirestorePromptPreset>) {
    const presetRef = doc(firestore, 'users', uid, 'promptPresets', presetId);
    await updateDoc(presetRef, updates);
  }

  static async deletePreset(uid: string, presetId: string) {
    const presetRef = doc(firestore, 'users', uid, 'promptPresets', presetId);
    await deleteDoc(presetRef);
  }
} 