import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** True after the user opened a password-reset link; the app asks for a new password. */
  recovering: boolean
  endRecovery: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/** Reset links come back as ?reset=1&code=…; the code is exchanged by supabase-js. */
function urlSaysRecovery(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('reset') === '1'
  } catch {
    return false
  }
}

/** Drop the one-time ?code / ?reset params so a reload or a shared link does not reuse them. */
function cleanAuthParams() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code') && !url.searchParams.has('reset')) return
  url.searchParams.delete('code')
  url.searchParams.delete('reset')
  window.history.replaceState(window.history.state, '', url.toString())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(urlSaysRecovery)

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (data.session) cleanAuthParams()
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      // Defer: calling supabase inside this callback can deadlock the auth client.
      setTimeout(() => {
        void loadProfile(next?.user.id)
        if (next) cleanAuthParams()
      }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        recovering,
        endRecovery: () => setRecovering(false),
        refreshProfile: () => loadProfile(session?.user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
