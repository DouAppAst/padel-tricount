import { describe, expect, it } from 'vitest'
import { simplifyDebts, transfersFor } from './debtSimplification'
import type { Transfer } from './models'

const balances = (record: Record<string, number>) => new Map(Object.entries(record))

function applyTransfers(record: Record<string, number>, transfers: Transfer[]) {
  const result = { ...record }
  for (const t of transfers) {
    result[t.fromId] += t.amountCents
    result[t.toId] -= t.amountCents
  }
  return result
}

describe('simplifyDebts', () => {
  it('nets out mutual debts', () => {
    // A owes 550 to B, B owes 1100 to A => A = +550, B = -550
    expect(simplifyDebts(balances({ A: 550, B: -550 }))).toEqual([
      { fromId: 'B', toId: 'A', amountCents: 550 },
    ])
  })

  it('one creditor, two debtors', () => {
    expect(simplifyDebts(balances({ A: 1100, B: -550, C: -550 }))).toEqual([
      { fromId: 'B', toId: 'A', amountCents: 550 },
      { fromId: 'C', toId: 'A', amountCents: 550 },
    ])
  })

  it('returns nothing when everybody is even', () => {
    expect(simplifyDebts(balances({ A: 0, B: 0 }))).toEqual([])
    expect(simplifyDebts(new Map())).toEqual([])
  })

  it('matches largest debtor with largest creditor', () => {
    expect(simplifyDebts(balances({ A: 1300, B: 550, C: -1850 }))).toEqual([
      { fromId: 'C', toId: 'A', amountCents: 1300 },
      { fromId: 'C', toId: 'B', amountCents: 550 },
    ])
  })

  it('is deterministic regardless of input order, using the tie-breaker', () => {
    const forward = simplifyDebts(balances({ A: 550, B: 550, C: -550, D: -550 }))
    const reverse = simplifyDebts(balances({ D: -550, C: -550, B: 550, A: 550 }))
    expect(reverse).toEqual(forward)
    expect(forward).toEqual([
      { fromId: 'C', toId: 'A', amountCents: 550 },
      { fromId: 'D', toId: 'B', amountCents: 550 },
    ])
    const byNameDesc = simplifyDebts(balances({ A: 550, B: 550, C: -550, D: -550 }), (a, b) =>
      b.localeCompare(a),
    )
    expect(byNameDesc[0]).toEqual({ fromId: 'D', toId: 'B', amountCents: 550 })
  })

  it('rejects balances that do not sum to zero', () => {
    expect(() => simplifyDebts(balances({ A: 550, B: -500 }))).toThrow(RangeError)
  })

  it('rejects non-integer balances', () => {
    expect(() => simplifyDebts(balances({ A: 5.5, B: -5.5 }))).toThrow(TypeError)
  })

  it('settles random balances with at most n - 1 positive transfers', () => {
    let seed = 42
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    for (let run = 0; run < 200; run++) {
      const ids = Array.from({ length: 2 + Math.floor(random() * 9) }, (_, i) => `P${i}`)
      const record: Record<string, number> = {}
      let sum = 0
      for (const id of ids.slice(1)) {
        record[id] = Math.round((random() - 0.5) * 10000)
        sum += record[id]
      }
      record[ids[0]] = -sum
      const nonZero = Object.values(record).filter((v) => v !== 0).length

      const transfers = simplifyDebts(balances(record))

      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1))
      expect(transfers.every((t) => t.amountCents > 0 && t.fromId !== t.toId)).toBe(true)
      expect(Object.values(applyTransfers(record, transfers)).every((v) => v === 0)).toBe(true)
    }
  })
})

describe('transfersFor', () => {
  it('splits transfers by direction', () => {
    const transfers = simplifyDebts(balances({ A: 1100, B: -550, C: -550 }))
    expect(transfersFor(transfers, 'A').toReceive).toHaveLength(2)
    expect(transfersFor(transfers, 'B')).toEqual({
      toPay: [{ fromId: 'B', toId: 'A', amountCents: 550 }],
      toReceive: [],
    })
  })
})
