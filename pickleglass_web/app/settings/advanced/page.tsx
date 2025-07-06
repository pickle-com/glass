'use client'

import { useState, useEffect } from 'react'
import { Settings, Wifi, Lock, Unlock } from 'lucide-react'
import { useRedirectIfNotAuth } from '@/utils/auth'
import { apiCall } from '@/utils/api'



export default function AdvancedSettingsPage() {
  const userInfo = useRedirectIfNotAuth()
  const [isSaving, setIsSaving] = useState(false)
  
  // Advanced settings state
  const [networkSettings, setNetworkSettings] = useState({
    apiPort: null as number | null,
    webPort: null as number | null,
    lockPorts: false,
    currentApiPort: null as number | null,
    currentWebPort: null as number | null
  })
  const [isLoadingNetworkSettings, setIsLoadingNetworkSettings] = useState(false)

  const fetchNetworkSettings = async () => {
    try {
      setIsLoadingNetworkSettings(true)
      console.log('[Advanced Settings] Fetching network settings via API...')
      const response = await apiCall('/api/network/settings', { method: 'GET' })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch network settings: ${response.status}`)
      }
      
      const settings = await response.json()
      console.log('[Advanced Settings] Retrieved network settings:', settings)
      setNetworkSettings(settings)
    } catch (error) {
      console.error("Failed to fetch network settings:", error)
    } finally {
      setIsLoadingNetworkSettings(false)
    }
  }

  useEffect(() => {
    if (!userInfo) return
    fetchNetworkSettings()
  }, [userInfo])

  const handleSaveNetworkSettings = async () => {
    setIsSaving(true)
    try {
      console.log('[Advanced Settings] Saving network settings via API:', networkSettings)
      const response = await apiCall('/api/network/settings', { 
        method: 'POST',
        body: JSON.stringify(networkSettings)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to save network settings: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Advanced Settings] Network settings saved:', result)
      await fetchNetworkSettings() // Refresh to get updated current ports
    } catch (error) {
      console.error("Failed to save network settings:", error)
      alert(error instanceof Error ? error.message : "Failed to save network settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLockCurrentPorts = async () => {
    setIsSaving(true)
    try {
      console.log('[Advanced Settings] Locking current ports via API...')
      const response = await apiCall('/api/network/lock-ports', { method: 'POST' })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to lock current ports: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Advanced Settings] Current ports locked:', result)
      await fetchNetworkSettings() // Refresh settings
    } catch (error) {
      console.error("Failed to lock current ports:", error)
      alert(error instanceof Error ? error.message : "Failed to lock current ports")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnlockPorts = async () => {
    setNetworkSettings(prev => ({
      ...prev,
      lockPorts: false,
      apiPort: null,
      webPort: null
    }))
  }

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'profile', name: 'Personal Profile', href: '/settings' },
    { id: 'privacy', name: 'Data & Privacy', href: '/settings/privacy' },
    { id: 'billing', name: 'Billing', href: '/settings/billing' },
    { id: 'advanced', name: 'Advanced', href: '/settings/advanced' },
  ]

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
                className={`pb-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  tab.id === 'advanced'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </a>
            ))}
          </nav>
        </div>

        <div className="space-y-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Advanced Settings</h3>
            </div>
            <p className="text-sm text-blue-700">
              Configure advanced system settings. Changes may require application restart.
            </p>
          </div>

          {/* Network Settings Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Network Settings</h3>
            </div>
            
            {isLoadingNetworkSettings ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading network settings...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Port Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Current Active Ports</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                    <span className="text-gray-600">API Port:</span>
                    <span className="ml-2 font-mono font-medium">
                      {networkSettings.currentApiPort ? networkSettings.currentApiPort : 'Auto-assigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Web Interface Port:</span>
                    <span className="ml-2 font-mono font-medium">
                      {networkSettings.currentWebPort ? networkSettings.currentWebPort : 'Auto-assigned'}
                    </span>
                  </div>
                  </div>
                </div>

                {/* Port Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">Port Configuration</h4>
                    <button
                      onClick={networkSettings.lockPorts ? handleUnlockPorts : handleLockCurrentPorts}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      disabled={isSaving}
                    >
                      {networkSettings.lockPorts ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Unlock Ports
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Lock Current Ports
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="api-port" className="block text-sm font-medium text-gray-700 mb-1">
                        API Port
                      </label>
                      <input
                        type="number"
                        id="api-port"
                        min="1024"
                        max="65535"
                        value={networkSettings.apiPort || ''}
                        onChange={(e) => setNetworkSettings(prev => ({
                          ...prev,
                          apiPort: e.target.value ? parseInt(e.target.value) : null
                        }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Auto-assign"
                        disabled={networkSettings.lockPorts}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty for auto-assignment
                      </p>
                    </div>

                    <div>
                      <label htmlFor="web-port" className="block text-sm font-medium text-gray-700 mb-1">
                        Web Interface Port
                      </label>
                      <input
                        type="number"
                        id="web-port"
                        min="1024"
                        max="65535"
                        value={networkSettings.webPort || ''}
                        onChange={(e) => setNetworkSettings(prev => ({
                          ...prev,
                          webPort: e.target.value ? parseInt(e.target.value) : null
                        }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Auto-assign"
                        disabled={networkSettings.lockPorts}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty for auto-assignment
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="lock-ports"
                      checked={networkSettings.lockPorts}
                      onChange={(e) => setNetworkSettings(prev => ({
                        ...prev,
                        lockPorts: e.target.checked
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="lock-ports" className="text-sm text-gray-700">
                      Lock these port settings (prevent auto-assignment)
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={handleSaveNetworkSettings}
                    disabled={isSaving}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Network Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Future Settings Placeholder */}
        </div>
      </div>
    </div>
  )
} 