import type { Venue } from '../../domain/models'
import { formatCents } from '../../domain/money'

export function venuePricesLabel(venue: Venue): string {
  const cse =
    venue.cseTicketCents === null
      ? 'pas de ticket CSE'
      : `ticket CSE ${formatCents(venue.cseTicketCents)}`
  return `Classique ${formatCents(venue.regularCents)} · ${cse}`
}
