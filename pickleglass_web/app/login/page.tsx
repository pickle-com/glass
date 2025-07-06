'use client'

import { useRouter } from 'next/navigation'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/utils/firebase'
import { Chrome } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isElectronMode, setIsElectronMode] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get('mode')
    setIsElectronMode(mode === 'electron')
  }, [])

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    setIsLoading(true)
    
    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      
      if (user) {
        console.log('✅ Google login successful:', user.uid)

        if (isElectronMode) {
          try {
            const idToken = await user.getIdToken()
            
            const deepLinkUrl = `pickleglass://auth-success?` + new URLSearchParams({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              token: idToken
            }).toString()
            
            console.log('🔗 Return to electron app via deep link:', deepLinkUrl)
            
            window.location.href = deepLinkUrl
            
            setTimeout(() => {
              alert('Login completed. Please return to Pickle Glass app.')
            }, 1000)
            
          } catch (error) {
            console.error('❌ Deep link processing failed:', error)
            alert('Login was successful but failed to return to app. Please check the app.')
          }
        } 
        else if (typeof window !== 'undefined' && window.require) {
          try {
            const { ipcRenderer } = window.require('electron')
            const idToken = await user.getIdToken()
            
            ipcRenderer.send('firebase-auth-success', {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              idToken
            })
            
            console.log('📡 Auth info sent to electron successfully')
          } catch (error) {
            console.error('❌ Electron communication failed:', error)
          }
        } 
        else {
          router.push('/settings')
        }
      }
    } catch (error: any) {
      console.error('❌ Google login failed:', error)
      
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('An error occurred during login. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Pickle Glass</h1>
        <p className="text-gray-600 mt-2">Sign in with your Google account to sync your data across all devices.</p>
        {isElectronMode ? (
          <p className="text-sm text-blue-600 mt-1 font-medium">🔗 Login requested from Electron app</p>
        ) : (
          <p className="text-sm text-gray-500 mt-1">Local mode will run if you don't sign in.</p>
        )}
      </div>
      
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Chrome className="h-5 w-5" />
            <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (isElectronMode) {
                  window.location.href = 'pickleglass://auth-success?uid=default_user&email=contact@pickle.com&displayName=Default%20User'
                } else {
                  router.push('/settings')
                }
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Continue in local mode
            </button>
          </div>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
} 