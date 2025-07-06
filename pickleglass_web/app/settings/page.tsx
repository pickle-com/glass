'use client'

import { useState, useEffect } from 'react'
import { Check, ExternalLink, Cloud, HardDrive } from 'lucide-react'
import { useAuth } from '@/utils/auth'
import { 
  UserProfile,
  getUserProfile,
  updateUserProfile,
  checkApiKeyStatus,
  saveApiKey,
  deleteAccount,
  logout
} from '@/utils/api'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    ipcRenderer?: any;
  }
}

type Tab = 'profile' | 'privacy' | 'billing'
type BillingCycle = 'monthly' | 'annually'

export default function SettingsPage() {
  const { user: userInfo, isLoading, mode } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState('')
  const router = useRouter()

  const fetchApiKeyStatus = async () => {
      try {
        const apiKeyStatus = await checkApiKeyStatus()
        setHasApiKey(apiKeyStatus.hasApiKey)
      } catch (error) {
        console.error("Failed to fetch API key status:", error);
      }
  }

  useEffect(() => {
    if (!userInfo) return

    const fetchProfileData = async () => {
      try {
        const userProfile = await getUserProfile()
        setProfile(userProfile)
        setDisplayNameInput(userProfile.display_name)
        await fetchApiKeyStatus();
      } catch (error) {
        console.error("Failed to fetch profile data:", error)
      }
    }
    fetchProfileData()

    if (window.ipcRenderer) {
      window.ipcRenderer.on('api-key-updated', () => {
        console.log('Received api-key-updated event from main process.');
        fetchApiKeyStatus();
      });
    }

    return () => {
      if (window.ipcRenderer) {
        window.ipcRenderer.removeAllListeners('api-key-updated');
      }
    }
  }, [userInfo])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!userInfo) {
    router.push('/login')
    return null
  }

  const isFirebaseMode = mode === 'firebase'

  const tabs = [
    { id: 'profile' as Tab, name: 'Personal Profile', href: '/settings' },
    { id: 'privacy' as Tab, name: 'Data & Privacy', href: '/settings/privacy' },
    { id: 'billing' as Tab, name: 'Billing', href: '/settings/billing' },
  ]

  const handleSaveApiKey = async () => {
    setIsSaving(true)
    try {
      await saveApiKey(apiKeyInput)
      setHasApiKey(true)
      setApiKeyInput('')
      if (window.ipcRenderer) {
        window.ipcRenderer.invoke('save-api-key', apiKeyInput);
      }
    } catch (error) {
      console.error("Failed to save API key:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateDisplayName = async () => {
    if (!profile || displayNameInput === profile.display_name) return;
    setIsSaving(true);
    try {
        await updateUserProfile({ displayName: displayNameInput });
        setProfile(prev => prev ? { ...prev, display_name: displayNameInput } : null);
    } catch (error) {
        console.error("Failed to update display name:", error);
    } finally {
        setIsSaving(false);
    }
  }

  const handleDeleteAccount = async () => {
    const confirmMessage = isFirebaseMode
      ? "Are you sure you want to delete your account? This action cannot be undone and all data stored in Firebase will be deleted."
      : "Are you sure you want to delete your account? This action cannot be undone and all data will be deleted."
    
    if (window.confirm(confirmMessage)) {
      try {
        await deleteAccount()
        router.push('/login');
      } catch (error) {
        console.error("Failed to delete account:", error)
      }
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const renderBillingContent = () => (
    <div className="space-y-8">
      <div className={`p-4 rounded-lg border ${isFirebaseMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          {isFirebaseMode ? (
            <Cloud className="h-5 w-5 text-blue-600" />
          ) : (
            <HardDrive className="h-5 w-5 text-gray-600" />
          )}
          <h3 className={`font-semibold ${isFirebaseMode ? 'text-blue-900' : 'text-gray-900'}`}>
            {isFirebaseMode ? 'Firebase Hosting Mode' : 'Local Execution Mode'}
          </h3>
        </div>
        <p className={`text-sm ${isFirebaseMode ? 'text-blue-700' : 'text-gray-700'}`}>
          {isFirebaseMode 
            ? 'All data is safely stored and synchronized in Firebase Cloud.'
            : 'Data is stored in local database and you can use personal API keys.'
          }
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-gray-200 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('annually')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            billingCycle === 'annually'
              ? 'bg-gray-200 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Annually
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Free</h3>
            <div className="text-3xl font-bold text-gray-900">
              $0<span className="text-lg font-normal text-gray-600">/month</span>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            Experience how Pickle Glass works with unlimited responses.
          </p>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Daily unlimited responses</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Unlimited access to free models</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Unlimited text output</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Screen viewing, audio listening</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Custom system prompts</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Community support only</span>
            </li>
          </ul>
          
          <button className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md font-medium">
            Current Plan
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 opacity-60">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
            <div className="text-3xl font-bold text-gray-900">
              $25<span className="text-lg font-normal text-gray-600">/month</span>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            Use latest models, get full response output, and work with custom prompts.
          </p>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Unlimited pro responses</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Unlimited access to latest models</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Full access to conversation dashboard</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">Priority support</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-700">All features from free plan</span>
            </li>
          </ul>
          
          <button className="w-full py-2 px-4 bg-cyan-400 text-white rounded-md font-medium">
            Coming Soon
          </button>
        </div>

        <div className="bg-gray-800 text-white rounded-lg p-6 opacity-60">
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
            <div className="text-xl font-semibold">Custom</div>
          </div>
          
          <p className="text-gray-300 mb-6">
            Specially crafted for teams that need complete customization.
          </p>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Custom integrations</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">User provisioning & role-based access</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Advanced post-call analytics</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Single sign-on</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Advanced security features</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Centralized billing</span>
            </li>
            <li className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <span className="text-sm text-gray-300">Usage analytics & reporting dashboard</span>
            </li>
          </ul>
          
          <button className="w-full py-2 px-4 bg-gray-600 text-white rounded-md font-medium">
            Coming Soon
          </button>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Check className="h-6 w-6 text-green-600" />
          <div>
            <h4 className="font-semibold text-green-900">All features are currently free!</h4>
            <p className="text-green-700 text-sm">
              {isFirebaseMode 
                ? 'Enjoy all Pickle Glass features for free in Firebase hosting mode. Pro and Enterprise plans will be released soon with additional premium features.'
                : 'Enjoy all Pickle Glass features for free in local mode. You can use personal API keys or continue using the free system.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'billing':
        return renderBillingContent()
      case 'profile':
        return (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg border ${isFirebaseMode ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isFirebaseMode ? (
                    <Cloud className="h-5 w-5 text-blue-600" />
                  ) : (
                    <HardDrive className="h-5 w-5 text-gray-600" />
                  )}
                  <div>
                    <h3 className={`font-semibold ${isFirebaseMode ? 'text-blue-900' : 'text-gray-900'}`}>
                      {isFirebaseMode ? 'Firebase Hosting Mode' : 'Local Execution Mode'}
                    </h3>
                    <p className={`text-sm ${isFirebaseMode ? 'text-blue-700' : 'text-gray-700'}`}>
                      {isFirebaseMode 
                        ? `Logged in with Google account (${userInfo.email})`
                        : 'Running as local user'
                      }
                    </p>
                  </div>
                </div>
                {isFirebaseMode && (
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Display Name</h3>
              <p className="text-sm text-gray-600 mb-4">Enter your full name or a display name you're comfortable using.</p>
              <div className="max-w-sm">
                 <input
                    type="text"
                    id="display-name"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-black"
                    maxLength={32}
                  />
                  <p className="text-xs text-gray-500 mt-2">You can use up to 32 characters.</p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                <button
                    onClick={handleUpdateDisplayName}
                    disabled={isSaving || !displayNameInput || displayNameInput === profile?.display_name}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
                  >
                    Update
                  </button>
              </div>
            </div>

            {!isFirebaseMode && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">API Key</h3>
                <p className="text-sm text-gray-600 mb-4">
                  If you want to use your own LLM API key, you can add it here. It will be used for all requests made by the local application.
                </p>
                
                <div className="max-w-sm">
                  <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      id="api-key"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-black"
                      placeholder="Enter new API key or existing API key"
                    />
                  </div>
                  {hasApiKey ? (
                    <p className="text-xs text-green-600 mt-2">API key is currently set.</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-2">No API key set. Using free system.</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                   <button
                      onClick={handleSaveApiKey}
                      disabled={isSaving || !apiKeyInput}
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
              </div>
            )}

            {(isFirebaseMode || (!isFirebaseMode && !hasApiKey)) && (
               <div className="bg-white border border-red-300 rounded-lg p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Account</h3>
                 <p className="text-sm text-gray-600 mb-4">
                   {isFirebaseMode 
                     ? 'Permanently remove your Firebase account and all content. This action cannot be undone, so please proceed carefully.'
                     : 'Permanently remove your personal account and all content from the Pickle Glass platform. This action cannot be undone, so please proceed carefully.'
                   }
                 </p>
                 <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={handleDeleteAccount}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        Delete
                    </button>
                 </div>
               </div>
            )}
          </div>
        )
      case 'privacy':
        return null
      default:
        return renderBillingContent()
    }
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="px-8 py-8">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Settings</p>
          <h1 className="text-3xl font-bold text-gray-900">Personal Settings</h1>
        </div>
        
        <div className="mb-8">
          <nav className="flex space-x-10">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                onClick={tab.id === 'privacy' ? undefined : () => setActiveTab(tab.id)}
                className={`pb-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </a>
            ))}
          </nav>
        </div>

        {renderTabContent()}
      </div>
    </div>
  )
} 