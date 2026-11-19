import type { Cents, Venue } from './models'

export interface CseBreakdown {
  tickets: number
  cashCents: Cents
}

/** How many whole CSE tickets fit in an amount (0 when tickets have no value). */
export function maxCseTickets(amountCents: Cents, ticketCents: Cents | null): number {
  if (!ticketCents || ticketCents <= 0 || amountCents <= 0) return 0
  return Math.floor(amountCents / ticketCents)
}

/**
 * Splits a refund into CSE tickets and cash. Defaults to as many tickets as possible;
 * a requested number of tickets is clamped so the cash part never goes negative.
 */
export function cseBreakdown(
  amountCents: Cents,
  ticketCents: Cents | null,
  tickets: number = maxCseTickets(amountCents, ticketCents),
): CseBreakdown {
  const count = Math.max(0, Math.min(Math.trunc(tickets), maxCseTickets(amountCents, ticketCents)))
  return { tickets: count, cashCents: amountCents - count * (ticketCents ?? 0) }
}

/** Value of a CSE ticket: the default club's price, else any active club accepting them. */
export function cseTicketValue(venues: Venue[], defaultVenueId: string | null): Cents | null {
  const defaultVenue = venues.find((v) => v.id === defaultVenueId)
  if (defaultVenue?.cseTicketCents != null) return defaultVenue.cseTicketCents
  return venues.find((v) => v.active && v.cseTicketCents !== null)?.cseTicketCents ?? null
}
