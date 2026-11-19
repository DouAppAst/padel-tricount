import { assertCents } from './money'
import type { Cents, Game, ParticipantId, Settlement, Transfer } from './models'

export interface ParticipantBalance {
  paidCents: Cents
  consumedCents: Cents
  refundsSentCents: Cents
  refundsReceivedCents: Cents
  /** > 0: should receive money, < 0: should pay. */
  netCents: Cents
}

const emptyBalance = (): ParticipantBalance => ({
  paidCents: 0,
  consumedCents: 0,
  refundsSentCents: 0,
  refundsReceivedCents: 0,
  netCents: 0,
})

/**
 * net = paid - consumed + refunds sent - refunds received.
 * Sending money settles a debt, so it moves the sender towards (or above) zero.
 * Deleted games and settlements are ignored. The sum of all nets is always 0.
 */
export function computeBalances(
  games: readonly Game[],
  settlements: readonly Settlement[],
): Map<ParticipantId, ParticipantBalance> {
  const balances = new Map<ParticipantId, ParticipantBalance>()
  const get = (id: ParticipantId) => {
    let balance = balances.get(id)
    if (!balance) {
      balance = emptyBalance()
      balances.set(id, balance)
    }
    return balance
  }

  for (const game of games) {
    if (game.deletedAt) continue
    for (const entry of game.entries) {
      assertCents(entry.amountCents)
      get(entry.paidById).paidCents += entry.amountCents
      get(entry.playerId).consumedCents += entry.amountCents
    }
  }

  for (const settlement of settlements) {
    if (settlement.deletedAt) continue
    assertCents(settlement.amountCents)
    get(settlement.fromId).refundsSentCents += settlement.amountCents
    get(settlement.toId).refundsReceivedCents += settlement.amountCents
  }

  for (const balance of balances.values()) {
    balance.netCents =
      balance.paidCents -
      balance.consumedCents +
      balance.refundsSentCents -
      balance.refundsReceivedCents
  }
  return balances
}

export function netBalances(
  balances: ReadonlyMap<ParticipantId, ParticipantBalance>,
): Map<ParticipantId, Cents> {
  return new Map([...balances].map(([id, balance]) => [id, balance.netCents]))
}

/**
 * Opening balances imported from the spreadsheet: "debtor owes amount to creditor"
 * is stored as money handed by the creditor to the debtor, which yields
 * creditor = +amount and debtor = -amount.
 */
export function openingSettlementFields(
  debt: Transfer,
): Pick<Settlement, 'fromId' | 'toId' | 'amountCents' | 'kind'> {
  return { fromId: debt.toId, toId: debt.fromId, amountCents: debt.amountCents, kind: 'OPENING' }
}
