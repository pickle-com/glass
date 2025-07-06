'use client'

import { ExternalLink } from 'lucide-react'
import { useRedirectIfNotAuth } from '@/utils/auth'

export default function PrivacySettingsPage() {
  const userInfo = useRedirectIfNotAuth()

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
    { id: 'profile', name: 'Personal profile', href: '/settings' },
    { id: 'privacy', name: 'Data & privacy', href: '/settings/privacy' },
    { id: 'billing', name: 'Billing', href: '/settings/billing' },
  ]

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="px-8 py-8">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Settings</p>
          <h1 className="text-3xl font-bold text-gray-900">Personal settings</h1>
        </div>
        
        <div className="mb-8">
          <nav className="flex space-x-10">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                className={`pb-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  tab.id === 'privacy'
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </a>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Privacy Policy</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Understand how we collect, use, and protect your personal information.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => window.open('https://www.pickle.com/ko/privacy-policy', '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
              >
                Privacy
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Terms of Service</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Understand your rights and responsibilities when using our platform.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => window.open('https://www.pickle.com/ko/terms-of-service', '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
              >
                Terms
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 