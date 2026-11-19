import type { CseBreakdown } from '../../domain/cseTickets'
import { formatCents } from '../../domain/money'

export const ticketsLabel = (count: number) => (count > 1 ? `${count} tickets CSE` : '1 ticket CSE')

/** "2 tickets CSE + 4,00 €", "2 tickets CSE" or "4,00 €". */
export function breakdownLabel({ tickets, cashCents }: CseBreakdown): string {
  if (tickets === 0) return formatCents(cashCents)
  return cashCents > 0
    ? `${ticketsLabel(tickets)} + ${formatCents(cashCents)}`
    : ticketsLabel(tickets)
}
