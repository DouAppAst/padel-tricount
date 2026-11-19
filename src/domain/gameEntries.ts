import type { Cents, GameEntry, ParticipantId, PaymentType, Prices, Transfer } from './models'

/** Default amount for a payment type. CUSTOM has no default and starts at 0. */
export function defaultAmount(paymentType: PaymentType, prices: Prices): Cents {
  switch (paymentType) {
    case 'CSE_TICKET':
      return prices.cseTicketCents
    case 'REGULAR':
      return prices.regularCents
    case 'FREE':
    case 'CUSTOM':
      return 0
  }
}

export function newEntry(
  playerId: ParticipantId,
  paymentType: PaymentType,
  prices: Prices,
): GameEntry {
  return {
    playerId,
    paidById: playerId,
    paymentType,
    amountCents: defaultAmount(paymentType, prices),
  }
}

/**
 * Changes the payment type of an existing line. The amount is reset to the
 * current price of the new type; lines that are not changed keep their
 * historical amount. Choosing CUSTOM keeps the previous amount as a starting point.
 */
export function changePaymentType(
  entry: GameEntry,
  paymentType: PaymentType,
  prices: Prices,
): GameEntry {
  if (paymentType === entry.paymentType) return entry
  const amountCents =
    paymentType === 'CUSTOM' ? entry.amountCents : defaultAmount(paymentType, prices)
  return { ...entry, paymentType, amountCents }
}

export function setPaymentTypeForAll(
  entries: GameEntry[],
  paymentType: PaymentType,
  prices: Prices,
): GameEntry[] {
  return entries.map((entry) => changePaymentType(entry, paymentType, prices))
}

export function setPaidByForAll(entries: GameEntry[], paidById: ParticipantId): GameEntry[] {
  return entries.map((entry) => ({ ...entry, paidById }))
}

export function gameTotal(entries: GameEntry[]): Cents {
  return entries.reduce((sum, entry) => sum + entry.amountCents, 0)
}

export type EntryValidationError =
  'NO_PLAYER' | 'DUPLICATE_PLAYER' | 'INVALID_AMOUNT' | 'FREE_NOT_ZERO'

export function validateEntries(entries: GameEntry[]): EntryValidationError[] {
  const errors = new Set<EntryValidationError>()
  if (entries.length === 0) errors.add('NO_PLAYER')
  const players = new Set<ParticipantId>()
  for (const entry of entries) {
    if (players.has(entry.playerId)) errors.add('DUPLICATE_PLAYER')
    players.add(entry.playerId)
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0)
      errors.add('INVALID_AMOUNT')
    if (entry.paymentType === 'FREE' && entry.amountCents !== 0) errors.add('FREE_NOT_ZERO')
  }
  return [...errors]
}

/** What each player owes to whoever paid their place in this game, aggregated per pair. */
export function gameDebts(entries: GameEntry[]): Transfer[] {
  const byPair = new Map<string, Transfer>()
  for (const entry of entries) {
    if (entry.paidById === entry.playerId || entry.amountCents === 0) continue
    const key = `${entry.playerId}->${entry.paidById}`
    const existing = byPair.get(key)
    if (existing) existing.amountCents += entry.amountCents
    else
      byPair.set(key, {
        fromId: entry.playerId,
        toId: entry.paidById,
        amountCents: entry.amountCents,
      })
  }
  return [...byPair.values()]
}

export interface PayerSummary {
  payerId: ParticipantId
  places: number
  amountCents: Cents
  paymentTypes: PaymentType[]
}

/** Who advanced how many places, in order of first appearance. */
export function payerSummaries(entries: GameEntry[]): PayerSummary[] {
  const byPayer = new Map<ParticipantId, PayerSummary>()
  for (const entry of entries) {
    let summary = byPayer.get(entry.paidById)
    if (!summary) {
      summary = { payerId: entry.paidById, places: 0, amountCents: 0, paymentTypes: [] }
      byPayer.set(entry.paidById, summary)
    }
    summary.places += 1
    summary.amountCents += entry.amountCents
    if (!summary.paymentTypes.includes(entry.paymentType))
      summary.paymentTypes.push(entry.paymentType)
  }
  return [...byPayer.values()]
}

export function countByPaymentType(entries: GameEntry[]): Partial<Record<PaymentType, number>> {
  const counts: Partial<Record<PaymentType, number>> = {}
  for (const entry of entries) counts[entry.paymentType] = (counts[entry.paymentType] ?? 0) + 1
  return counts
}
