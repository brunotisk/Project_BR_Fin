import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { databaseProvider } from './databaseProvider'

type AuthContextValue = {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, nome?: string) => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function ensureNhostProfile(user: any) {
  if (databaseProvider !== 'nhost' || !user?.id) return
  const { data, error } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (error || data) return
  const metadata = user.user_metadata || {}
  await supabase.from('profiles').insert({
    id: user.id,
    nome: metadata.nome || user.displayName || null,
    email: user.email || null
  })
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      void ensureNhostProfile(data.session?.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void ensureNhostProfile(nextSession?.user)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }

  const signUp = async (email: string, password: string, nome?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: nome?.trim() ? { data: { nome: nome.trim() } } : undefined
    })
    if (!error && databaseProvider === 'nhost') {
      const { data } = await supabase.auth.getSession()
      await ensureNhostProfile(data.session?.user)
    }
    return { error: error ? new Error(error.message) : null }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error: error ? new Error(error.message) : null }
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
