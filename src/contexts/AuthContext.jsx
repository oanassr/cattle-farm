import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      await loadProfile(s?.user?.id)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, fullName, role = 'seller') =>
    supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role } },
    })

  const signOut = () => supabase.auth.signOut()

  const value = {
    session,
    user: session?.user || null,
    profile,
    role: profile?.role || null,
    loading,
    signIn, signUp, signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
