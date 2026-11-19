import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

export interface AppSettings {
  defaultVenueId: string | null
}

export async function getSettings(): Promise<AppSettings> {
  const row = unwrap(
    await supabase()
      .from('settings')
      .select('default_venue_id')
      .single<{ default_venue_id: string | null }>(),
  )
  return { defaultVenueId: row.default_venue_id }
}

export async function setDefaultVenue(venueId: string): Promise<void> {
  ensureOk(await supabase().from('settings').update({ default_venue_id: venueId }).eq('id', 1))
}
