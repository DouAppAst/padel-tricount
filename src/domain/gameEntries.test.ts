import { describe, expect, it } from 'vitest'
import {
  applyPrices,
  changePaymentType,
  countByPaymentType,
  gameDebts,
  gameTotal,
  newEntry,
  payerSummaries,
  setPaidByForAll,
  setCustomAmounts,
  setPaymentTypeForAll,
  splitEvenly,
  validateEntries,
} from './gameEntries'
import type { GameEntry, Prices } from './models'

const PRICES: Prices = { cseTicketCents: 550, regularCents: 1300 }
const NEW_PRICES: Prices = { cseTicketCents: 600, regularCents: 1400 }

describe('newEntry', () => {
  it('defaults to the current price and to self-payment', () => {
    expect(newEntry('a', 'CSE_TICKET', PRICES)).toEqual({
      playerId: 'a',
      paidById: 'a',
      paymentType: 'CSE_TICKET',
      amountCents: 550,
    })
    expect(newEntry('a', 'REGULAR', PRICES).amountCents).toBe(1300)
    expect(newEntry('a', 'FREE', PRICES).amountCents).toBe(0)
  })
})

describe('editing an old game after a price change', () => {
  const oldGame: GameEntry[] = [
    newEntry('a', 'CSE_TICKET', PRICES),
    newEntry('b', 'CSE_TICKET', PRICES),
  ]

  it('keeps the historical amount when the payment type is unchanged', () => {
    expect(changePaymentType(oldGame[0], 'CSE_TICKET', NEW_PRICES).amountCents).toBe(550)
  })

  it('applies the current price when the payment type changes', () => {
    expect(changePaymentType(oldGame[0], 'REGULAR', NEW_PRICES).amountCents).toBe(1400)
  })

  it('keeps the previous amount as a starting point for CUSTOM', () => {
    expect(changePaymentType(oldGame[0], 'CUSTOM', NEW_PRICES).amountCents).toBe(550)
  })

  it('bulk change only reprices lines whose type changes', () => {
    const mixed = [oldGame[0], newEntry('c', 'REGULAR', PRICES)]
    expect(setPaymentTypeForAll(mixed, 'CSE_TICKET', NEW_PRICES).map((e) => e.amountCents)).toEqual(
      [550, 600],
    )
  })
})

describe('bulk actions and totals', () => {
  it('one person pays for everybody', () => {
    const entries = setPaidByForAll(
      ['a', 'b', 'c', 'd'].map((id) => newEntry(id, 'CSE_TICKET', PRICES)),
      'a',
    )
    expect(entries.every((e) => e.paidById === 'a')).toBe(true)
    expect(gameTotal(entries)).toBe(2200)
  })

  it('mixed game total', () => {
    const entries = [
      newEntry('a', 'CSE_TICKET', PRICES),
      newEntry('b', 'CSE_TICKET', PRICES),
      newEntry('c', 'CSE_TICKET', PRICES),
      newEntry('d', 'REGULAR', PRICES),
    ]
    expect(gameTotal(entries)).toBe(2950)
  })
})

describe('validateEntries', () => {
  it('accepts a valid game', () => {
    expect(validateEntries([newEntry('a', 'CSE_TICKET', PRICES)])).toEqual([])
  })

  it('reports every problem', () => {
    const entry = newEntry('a', 'CUSTOM', PRICES)
    expect(validateEntries([])).toEqual(['NO_PLAYER'])
    expect(validateEntries([entry, entry])).toEqual(['DUPLICATE_PLAYER'])
    expect(validateEntries([{ ...entry, amountCents: -1 }])).toEqual(['INVALID_AMOUNT'])
    expect(validateEntries([{ ...entry, amountCents: 5.5 }])).toEqual(['INVALID_AMOUNT'])
    expect(validateEntries([{ ...entry, paymentType: 'FREE', amountCents: 100 }])).toEqual([
      'FREE_NOT_ZERO',
    ])
  })
})

describe('game recap', () => {
  // Spec example: A pays 3 CSE tickets, D pays her own regular place.
  const entries: GameEntry[] = [
    newEntry('A', 'CSE_TICKET', PRICES),
    { ...newEntry('B', 'CSE_TICKET', PRICES), paidById: 'A' },
    { ...newEntry('C', 'CSE_TICKET', PRICES), paidById: 'A' },
    newEntry('D', 'REGULAR', PRICES),
  ]

  it('lists what each player owes to the payer', () => {
    expect(gameDebts(entries)).toEqual([
      { fromId: 'B', toId: 'A', amountCents: 550 },
      { fromId: 'C', toId: 'A', amountCents: 550 },
    ])
  })

  it('ignores free places paid by someone else', () => {
    expect(gameDebts([{ ...newEntry('B', 'FREE', PRICES), paidById: 'A' }])).toEqual([])
  })

  it('summarises payers', () => {
    expect(payerSummaries(entries)).toEqual([
      { payerId: 'A', places: 3, amountCents: 1650, paymentTypes: ['CSE_TICKET'] },
      { payerId: 'D', places: 1, amountCents: 1300, paymentTypes: ['REGULAR'] },
    ])
    expect(countByPaymentType(entries)).toEqual({ CSE_TICKET: 3, REGULAR: 1 })
  })
})

describe('clubs with their own prices', () => {
  const CUGNAUX: Prices = { regularCents: 800, cseTicketCents: null }
  const entries: GameEntry[] = [
    newEntry('A', 'CSE_TICKET', PRICES),
    newEntry('B', 'REGULAR', PRICES),
    newEntry('C', 'FREE', PRICES),
    { ...newEntry('D', 'CUSTOM', PRICES), amountCents: 700 },
  ]

  it('reprices CSE and regular places, CSE becoming regular where not accepted', () => {
    expect(applyPrices(entries, CUGNAUX).map((e) => [e.paymentType, e.amountCents])).toEqual([
      ['REGULAR', 800],
      ['REGULAR', 800],
      ['FREE', 0],
      ['CUSTOM', 700],
    ])
  })

  it('keeps CSE tickets where accepted', () => {
    expect(applyPrices(entries, NEW_PRICES).map((e) => e.amountCents)).toEqual([600, 1400, 0, 700])
  })

  it('never charges 0 for a CSE ticket where tickets are not accepted', () => {
    expect(newEntry('A', 'CSE_TICKET', CUGNAUX).amountCents).toBe(800)
  })
})

describe('splitEvenly', () => {
  it.each([
    [3200, 4, [800, 800, 800, 800]],
    [1000, 3, [334, 333, 333]],
    [2, 4, [1, 1, 0, 0]],
    [0, 2, [0, 0]],
  ])('%i in %i parts', (total, count, expected) => {
    const parts = splitEvenly(total, count)
    expect(parts).toEqual(expected)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
  })

  it('rejects invalid input', () => {
    expect(splitEvenly(100, 0)).toEqual([])
    expect(splitEvenly(-1, 2)).toEqual([])
  })

  it('a session total becomes custom amounts', () => {
    const players = [newEntry('A', 'CSE_TICKET', PRICES), newEntry('B', 'REGULAR', PRICES)]
    expect(setCustomAmounts(players, splitEvenly(1601, 2))).toMatchObject([
      { paymentType: 'CUSTOM', amountCents: 801 },
      { paymentType: 'CUSTOM', amountCents: 800 },
    ])
  })
})
