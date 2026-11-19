import type { Cents, Venue } from '../../domain/models'
import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

interface VenueRow {
  id: string
  name: string
  regular_price_cents: number
  cse_ticket_price_cents: number | null
  active: boolean
}

const toVenue = (row: VenueRow): Venue => ({
  id: row.id,
  name: row.name,
  regularCents: row.regular_price_cents,
  cseTicketCents: row.cse_ticket_price_cents,
  active: row.active,
})

export async function listVenues(): Promise<Venue[]> {
  const rows = unwrap(
    await supabase()
      .from('venues')
      .select('id, name, regular_price_cents, cse_ticket_price_cents, active')
      .order('name')
      .returns<VenueRow[]>(),
  )
  return rows.map(toVenue)
}

export interface VenueInput {
  name: string
  regularCents: Cents
  cseTicketCents: Cents | null
}

const toRow = (input: VenueInput) => ({
  name: input.name.trim(),
  regular_price_cents: input.regularCents,
  cse_ticket_price_cents: input.cseTicketCents,
})

export async function createVenue(input: VenueInput): Promise<void> {
  ensureOk(await supabase().from('venues').insert(toRow(input)))
}

export async function updateVenue(id: string, input: VenueInput): Promise<void> {
  ensureOk(await supabase().from('venues').update(toRow(input)).eq('id', id))
}

export async function setVenueActive(id: string, active: boolean): Promise<void> {
  ensureOk(await supabase().from('venues').update({ active }).eq('id', id))
}
