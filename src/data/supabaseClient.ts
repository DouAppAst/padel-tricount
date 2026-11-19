import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

let client: SupabaseClient | undefined

export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !publishableKey) {
      throw new Error(
        'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY',
      )
    }
    client = createClient(url, publishableKey)
  }
  return client
}
