'use client'

import { Download, Smartphone, Monitor, Tablet } from 'lucide-react'
import { useRedirectIfNotAuth } from '@/utils/auth'

export default function DownloadPage() {
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
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Download pickleglass</h1>
        <p className="text-lg text-gray-600 mb-12">
          Use pickleglass on various platforms
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition-shadow">
            <Monitor className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Desktop</h3>
            <p className="text-gray-600 mb-6">Windows, macOS, Linux</p>
            <button className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="h-5 w-5 inline mr-2" />
              Download Desktop
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition-shadow">
            <Smartphone className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Mobile</h3>
            <p className="text-gray-600 mb-6">iOS, Android</p>
            <div className="space-y-3">
              <button className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors">
                App Store
              </button>
              <button className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors">
                Google Play
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-lg transition-shadow">
            <Tablet className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Tablet</h3>
            <p className="text-gray-600 mb-6">iPad, Android Tablet</p>
            <button className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors">
              <Download className="h-5 w-5 inline mr-2" />
              Download Tablet
            </button>
          </div>
        </div>

        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Windows</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Windows 10 or later</li>
                <li>• 4GB RAM</li>
                <li>• 100MB Storage</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">macOS</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• macOS 11.0 or later</li>
                <li>• 4GB RAM</li>
                <li>• 100MB Storage</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Mobile</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• iOS 14.0 or later</li>
                <li>• Android 8.0 or later</li>
                <li>• 50MB Storage</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Having issues? Check out our <a href="/help" className="text-blue-600 hover:text-blue-700">Help Center</a>.
          </p>
        </div>
      </div>
    </div>
  )
} 