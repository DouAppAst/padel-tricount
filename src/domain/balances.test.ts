import { describe, expect, it } from 'vitest'
import { computeBalances, netBalances, openingSettlementFields } from './balances'
import type { Game, GameEntry, PaymentType, Settlement } from './models'

const PRICE: Record<PaymentType, number> = { CSE_TICKET: 550, REGULAR: 1300, FREE: 0, CUSTOM: 0 }

function entry(
  playerId: string,
  paidById: string,
  paymentType: PaymentType = 'CSE_TICKET',
): GameEntry {
  return { playerId, paidById, paymentType, amountCents: PRICE[paymentType] }
}

function game(entries: GameEntry[], extra: Partial<Game> = {}): Game {
  return { id: 'g', playedAt: '2026-11-16', location: 'Club', entries, ...extra }
}

function refund(
  fromId: string,
  toId: string,
  amountCents: number,
  extra: Partial<Settlement> = {},
): Settlement {
  return { id: 's', fromId, toId, amountCents, kind: 'REFUND', settledAt: '2026-11-17', ...extra }
}

function nets(games: Game[], settlements: Settlement[] = []) {
  const result = Object.fromEntries(netBalances(computeBalances(games, settlements)))
  const sum = Object.values(result).reduce((a, b) => a + b, 0)
  expect(sum).toBe(0)
  return result
}

// Spec example: A pays 3 CSE tickets, D pays her own regular place.
const SPEC_GAME = game([
  entry('A', 'A'),
  entry('B', 'A'),
  entry('C', 'A'),
  entry('D', 'D', 'REGULAR'),
])

describe('computeBalances', () => {
  it('spec example', () => {
    expect(nets([SPEC_GAME])).toEqual({ A: 1100, B: -550, C: -550, D: 0 })
    const a = computeBalances([SPEC_GAME], []).get('A')
    expect(a).toEqual({
      paidCents: 1650,
      consumedCents: 550,
      refundsSentCents: 0,
      refundsReceivedCents: 0,
      netCents: 1100,
    })
  })

  it('everybody pays their own place', () => {
    expect(nets([game(['A', 'B', 'C', 'D'].map((id) => entry(id, id, 'REGULAR')))])).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    })
  })

  it('payer who does not play', () => {
    expect(nets([game([entry('A', 'Z'), entry('B', 'Z')])])).toEqual({ Z: 1100, A: -550, B: -550 })
  })

  it('a refund moves both debtor and creditor towards zero', () => {
    expect(nets([SPEC_GAME], [refund('B', 'A', 550)])).toEqual({ A: 550, B: 0, C: -550, D: 0 })
  })

  it('accumulates over several games and partially offsets', () => {
    const other = game([entry('A', 'B'), entry('B', 'B')])
    expect(nets([SPEC_GAME, other])).toEqual({ A: 550, B: 0, C: -550, D: 0 })
  })

  it('ignores deleted games and settlements', () => {
    const deletedGame = game([entry('A', 'B')], { deletedAt: '2026-11-18' })
    const deletedRefund = refund('B', 'A', 550, { deletedAt: '2026-11-18' })
    expect(nets([SPEC_GAME, deletedGame], [deletedRefund])).toEqual({
      A: 1100,
      B: -550,
      C: -550,
      D: 0,
    })
  })

  it('free places cost nothing', () => {
    expect(nets([game([entry('A', 'A'), entry('B', 'A', 'FREE')])])).toEqual({ A: 0, B: 0 })
  })

  it('rejects non-integer amounts', () => {
    const bad = game([{ ...entry('A', 'B'), amountCents: 5.5 }])
    expect(() => computeBalances([bad], [])).toThrow(TypeError)
  })
})

describe('openingSettlementFields', () => {
  it('"B owes 1000 to A" makes A +1000 and B -1000', () => {
    const fields = openingSettlementFields({ fromId: 'B', toId: 'A', amountCents: 1000 })
    expect(fields).toEqual({ fromId: 'A', toId: 'B', amountCents: 1000, kind: 'OPENING' })
    const opening: Settlement = { ...fields, id: 'o', settledAt: '2026-11-01' }
    expect(nets([], [opening])).toEqual({ A: 1000, B: -1000 })
  })
})
