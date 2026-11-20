import { describe, expect, it } from 'vitest'
import { gamesCsv, settlementsCsv } from './exportCsv'
import type { Game, Settlement } from './models'

const names: Record<string, string> = { a: 'Alice', b: 'Bruno; "B"' }
const nameOf = (id: string | null | undefined) => (id && names[id]) || '?'

describe('gamesCsv', () => {
  it('writes one line per player, oldest game first, Excel-friendly', () => {
    const games: Game[] = [
      {
        id: '2',
        playedAt: '2026-11-19',
        location: 'Club',
        deletedAt: '2026-11-20',
        entries: [{ playerId: 'a', paidById: 'a', paymentType: 'REGULAR', amountCents: 1300 }],
      },
      {
        id: '1',
        playedAt: '2026-10-15',
        location: 'Cugnaux',
        comment: 'ligne\nsuivante',
        entries: [{ playerId: 'b', paidById: 'a', paymentType: 'CUSTOM', amountCents: 800 }],
      },
    ]
    const csv = gamesCsv(games, nameOf)
    expect(csv.startsWith('\uFEFFDate;Lieu;')).toBe(true)
    expect(csv.split('\r\n').slice(1, 3)).toEqual([
      '2026-10-15;Cugnaux;"Bruno; ""B""";Perso;8,00;Alice;"ligne\nsuivante";',
      '2026-11-19;Club;Alice;Classique;13,00;Alice;;oui',
    ])
  })
})

describe('settlementsCsv', () => {
  it('includes the kind and the CSE tickets', () => {
    const settlements: Settlement[] = [
      {
        id: 's',
        fromId: 'b',
        toId: 'a',
        amountCents: 1500,
        kind: 'REFUND',
        settledAt: '2026-11-19',
        cseTickets: 2,
      },
    ]
    expect(settlementsCsv(settlements, nameOf).split('\r\n')[1]).toBe(
      '2026-11-19;Remboursement;"Bruno; ""B""";Alice;15,00;2;;',
    )
  })
})
