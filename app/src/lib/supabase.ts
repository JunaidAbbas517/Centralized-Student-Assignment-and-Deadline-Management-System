import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createDemoClient } from './demoClient'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Demo mode (`npm run demo`) runs the UI on in-memory sample data, with no backend. */
export const isDemo = import.meta.env.VITE_DEMO === 'true'
export const isConfigured = isDemo || Boolean(url && anonKey)

// Only the public anon key is ever used in the browser; access is enforced by RLS.
export const supabase: SupabaseClient = isDemo
  ? (createDemoClient() as unknown as SupabaseClient)
  : createClient(url ?? 'http://localhost', anonKey ?? 'missing')
