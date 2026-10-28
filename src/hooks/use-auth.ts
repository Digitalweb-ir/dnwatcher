'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [authStatus, setAuthStatus] = useState({ authenticated: false, loading: true })
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        setAuthStatus({ authenticated: data.authenticated, loading: false })
      } catch {
        setAuthStatus({ authenticated: false, loading: false })
      }
    }
    checkAuth()
  }, [])

  async function logout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        setAuthStatus({ authenticated: false, loading: false })
        router.push('/login')
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return { ...authStatus, logout }
}
