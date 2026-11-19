import { assertCents } from './money'
import type { Cents, ParticipantId, Transfer } from './models'

interface Remaining {
  id: ParticipantId
  amount: Cents
}

/**
 * Greedy settlement: repeatedly match the largest debtor with the largest
 * creditor. Produces at most n - 1 transfers (not always the absolute minimum,
 * which is NP-hard). Ties are broken with `compareIds` so the output is stable.
 */
export function simplifyDebts(
  balances: ReadonlyMap<ParticipantId, Cents>,
  compareIds: (a: ParticipantId, b: ParticipantId) => number = (a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
): Transfer[] {
  let total = 0
  const creditors: Remaining[] = []
  const debtors: Remaining[] = []
  for (const [id, amount] of balances) {
    assertCents(amount)
    total += amount
    if (amount > 0) creditors.push({ id, amount })
    else if (amount < 0) debtors.push({ id, amount: -amount })
  }
  if (total !== 0) throw new RangeError(`Balances must sum to 0, got ${total}`)

  const byLargest = (a: Remaining, b: Remaining) => b.amount - a.amount || compareIds(a.id, b.id)
  const transfers: Transfer[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byLargest)
    debtors.sort(byLargest)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.amount, debtor.amount)
    transfers.push({ fromId: debtor.id, toId: creditor.id, amountCents: amount })
    creditor.amount -= amount
    debtor.amount -= amount
    if (creditor.amount === 0) creditors.shift()
    if (debtor.amount === 0) debtors.shift()
  }
  return transfers
}

/** Transfers involving a given participant, split by direction. */
export function transfersFor(transfers: readonly Transfer[], id: ParticipantId) {
  return {
    toPay: transfers.filter((t) => t.fromId === id),
    toReceive: transfers.filter((t) => t.toId === id),
  }
}
