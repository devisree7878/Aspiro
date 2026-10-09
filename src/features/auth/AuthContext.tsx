import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configured } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

interface Ctx {
  session: Session | null; profile: Profile | null; isAdmin: boolean; loading: boolean
  refresh: () => Promise<void>; signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  // Authorization always comes from the database (admins table via is_admin()), never from the client.
  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setIsAdmin(false); return }
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.rpc('is_admin')
    ])
    setProfile((p.data as Profile) ?? null)
    setIsAdmin(a.data === true)
  }, [])

  useEffect(() => {
    if (!configured) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); await load(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setTimeout(() => { load(s) }, 0) // defer to avoid deadlocks inside the auth callback
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const refresh = useCallback(async () => { await load(session) }, [load, session])
  const signOut = useCallback(async () => { await supabase.auth.signOut(); setProfile(null); setIsAdmin(false) }, [])

  return <AuthCtx.Provider value={{ session, profile, isAdmin, loading, refresh, signOut }}>{children}</AuthCtx.Provider>
}
