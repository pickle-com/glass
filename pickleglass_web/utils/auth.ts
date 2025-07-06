import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, setUserInfo, findOrCreateUser } from './api'
import { auth as firebaseAuth } from './firebase'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'

const defaultLocalUser: UserProfile = {
  uid: 'default_user',
  display_name: 'Default User',
  email: 'contact@pickle.com',
};

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<'local' | 'firebase' | null>(null)
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        console.log('🔥 Firebase mode activated:', firebaseUser.uid);
        setMode('firebase');
        
        let profile: UserProfile = {
          uid: firebaseUser.uid,
          display_name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || 'no-email@example.com',
        };
        
        try {
          profile = await findOrCreateUser(profile);
          console.log('✅ Firestore user created/verified:', profile);
        } catch (error) {
          console.error('❌ Firestore user creation/verification failed:', error);
        }

        setUser(profile);
        setUserInfo(profile);
        
        if (window.ipcRenderer) {
          window.ipcRenderer.send('set-current-user', profile.uid);
        }

      } else {
        console.log('🏠 Local mode activated');
        setMode('local');
        
        setUser(defaultLocalUser);
        setUserInfo(defaultLocalUser);

        if (window.ipcRenderer) {
          window.ipcRenderer.send('set-current-user', defaultLocalUser.uid);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [])

  return { user, isLoading, mode }
}

export const useRedirectIfNotAuth = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // This hook is now simplified. It doesn't redirect for local mode.
    // If you want to force login for hosting mode, you'd add logic here.
    // For example: if (!isLoading && !user) router.push('/login');
    // But for now, we allow both modes.
  }, [user, isLoading, router])

  return user
} 