'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRedirectIfNotAuth } from '@/utils/auth'
import {
  UserProfile,
  Session,
  getSessions,
  deleteSession,
} from '@/utils/api'

export default function ActivityPage() {
  const userInfo = useRedirectIfNotAuth() as UserProfile | null;
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSessions = async () => {
    try {
      const fetchedSessions = await getSessions();
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

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

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this activity? This cannot be undone.')) return;
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);
      setSessions(sessions => sessions.filter(s => s.id !== sessionId));
    } catch (error) {
      alert('Failed to delete activity.');
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-2xl text-gray-600">
            {getGreeting()}, {userInfo.display_name}
          </h1>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
            Your Past Activity
          </h2>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading conversations...</p>
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="block bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <Link href={`/activity/details?sessionId=${session.id}`} className="text-lg font-medium text-gray-900 hover:underline">
                        {session.title || `Conversation - ${new Date(session.started_at * 1000).toLocaleDateString()}`}
                      </Link>
                      <div className="text-sm text-gray-500">
                        {new Date(session.started_at * 1000).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(session.id)}
                      disabled={deletingId === session.id}
                      className={`ml-4 px-3 py-1 rounded text-xs font-medium border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors ${deletingId === session.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {deletingId === session.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  <span className={`capitalize inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${session.session_type === 'listen' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {session.session_type || 'ask'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center bg-white rounded-lg p-12">
              <p className="text-gray-500 mb-4">
                No conversations yet. Start a conversation in the desktop app to see your activity here.
              </p>
              <div className="text-sm text-gray-400">
                💡 Tip: Use the desktop app to have AI-powered conversations that will appear here automatically.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 