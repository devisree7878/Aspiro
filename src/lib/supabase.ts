import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)
// Only the public anon key is ever used in the browser. Authorization is enforced by RLS + RPCs.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-anon-key')

/** Throw a readable Error for any Supabase error so react-query / try-catch can surface it. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
