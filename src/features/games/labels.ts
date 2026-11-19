import type { PaymentType } from '../../domain/models'
import { countByPaymentType } from '../../domain/gameEntries'
import type { GameEntry } from '../../domain/models'

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  CSE_TICKET: 'Ticket CSE',
  REGULAR: 'Classique',
  FREE: 'Offert',
  CUSTOM: 'Perso',
}

const PLURAL_LABELS: Record<PaymentType, [string, string]> = {
  CSE_TICKET: ['ticket CSE', 'tickets CSE'],
  REGULAR: ['place classique', 'places classiques'],
  FREE: ['place offerte', 'places offertes'],
  CUSTOM: ['montant perso', 'montants perso'],
}

/** "3 tickets CSE, 1 place classique" */
export function paymentTypesSummary(entries: GameEntry[]): string {
  return Object.entries(countByPaymentType(entries))
    .map(([type, count]) => {
      const [one, many] = PLURAL_LABELS[type as PaymentType]
      return `${count} ${count > 1 ? many : one}`
    })
    .join(', ')
}

export function placesLabel(count: number): string {
  return count > 1 ? `${count} places` : '1 place'
}
