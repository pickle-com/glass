'use client'

import { HelpCircle, Book, MessageCircle, Mail } from 'lucide-react'
import { useRedirectIfNotAuth } from '@/utils/auth'

export default function HelpPage() {
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

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Help Center</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Book className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Getting Started</h2>
            </div>
            <p className="text-gray-600 mb-4">
              New to pickleglass? Learn about basic features and setup methods.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Setting up personalized contexts</li>
              <li>• Selecting presets and creating custom contexts</li>
              <li>• Checking activity records</li>
              <li>• Changing settings</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <HelpCircle className="h-6 w-6 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Check out frequently asked questions and answers from other users.
            </p>
            <div className="space-y-3">
              <details className="text-sm">
                <summary className="font-medium text-gray-700 cursor-pointer">
                  How do I change the context?
                </summary>
                <p className="text-gray-600 mt-2 pl-4">
                  On the Personalize page, select a preset or enter a custom context, then click the Save button.
                </p>
              </details>
              <details className="text-sm">
                <summary className="font-medium text-gray-700 cursor-pointer">
                  Where can I check my activity history?
                </summary>
                <p className="text-gray-600 mt-2 pl-4">
                  You can check your past activity records on the My Activity page.
                </p>
              </details>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <MessageCircle className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Community</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Connect with other users and share tips.
            </p>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Join Community →
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Mail className="h-6 w-6 text-red-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Couldn't find a solution? Contact us directly.
            </p>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Contact via Email →
            </button>
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">💡 Tip</h3>
          <p className="text-gray-700">
            Each context is optimized for different situations. 
            Choose the appropriate preset for your work environment, 
            or create your own custom context!
          </p>
        </div>
      </div>
    </div>
  )
} 