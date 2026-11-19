import type { Prices } from '../../domain/models'
import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

export interface AppSettings {
  prices: Prices
  defaultLocation: string
}

interface SettingsRow {
  cse_ticket_price_cents: number
  regular_price_cents: number
  default_location: string
}

export async function getSettings(): Promise<AppSettings> {
  const row = unwrap(
    await supabase()
      .from('settings')
      .select('cse_ticket_price_cents, regular_price_cents, default_location')
      .single<SettingsRow>(),
  )
  return {
    prices: { cseTicketCents: row.cse_ticket_price_cents, regularCents: row.regular_price_cents },
    defaultLocation: row.default_location,
  }
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  ensureOk(
    await supabase()
      .from('settings')
      .update({
        cse_ticket_price_cents: settings.prices.cseTicketCents,
        regular_price_cents: settings.prices.regularCents,
        default_location: settings.defaultLocation.trim(),
      })
      .eq('id', 1),
  )
}
