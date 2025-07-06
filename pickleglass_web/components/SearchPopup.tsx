'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { searchConversations, Session } from '@/utils/api'
import { MessageSquare } from 'lucide-react'

interface SearchPopupProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchPopup({ isOpen, onClose }: SearchPopupProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    try {
      const results = await searchConversations(query)
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    handleSearch(query)
  }

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-25 flex items-start justify-center pt-16 z-50"
      onClick={handleBackgroundClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center px-4 py-3">
          <Search className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            placeholder="Search..."
            className="flex-1 text-gray-900 text-base border-0 focus:outline-none placeholder-gray-400 bg-transparent"
          />
          <button
            onClick={onClose}
            className="ml-3 p-1 hover:bg-gray-100 rounded-full flex-shrink-0"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-600">
            <span>Type</span>
            <span className="mx-2 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono">#</span>
            <span>to access summaries,</span>
            <span className="mx-2 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono">?</span>
            <span>for help.</span>
          </div>
        </div>

        {searchQuery && (
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {searchResults.map((result) => {
                  const timestamp = new Date(result.started_at * 1000).toLocaleString()

                  return (
                    <div
                      key={result.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        router.push(`/activity/${result.id}`)
                        onClose()
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 mb-1 truncate">
                            {result.title || 'Untitled Conversation'}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">{timestamp}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No results found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 