import { createClient } from '@supabase/supabase-js'

// persistSession keeps the nailtech signed in (a secure session token, never her password).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'cpn-auth' } }
)

export const publicUrl = (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
