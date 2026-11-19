import { describe, expect, it } from 'vitest'
import { cseBreakdown, cseTicketValue, maxCseTickets } from './cseTickets'
import type { Venue } from './models'

describe('cseBreakdown', () => {
  it.each([
    [1100, { tickets: 2, cashCents: 0 }],
    [200, { tickets: 0, cashCents: 200 }],
    [1500, { tickets: 2, cashCents: 400 }],
    [549, { tickets: 0, cashCents: 549 }],
    [550, { tickets: 1, cashCents: 0 }],
  ])('%i cents with 5,50 € tickets', (amount, expected) => {
    expect(cseBreakdown(amount, 550)).toEqual(expected)
  })

  it('uses the requested number of tickets, never more than possible', () => {
    expect(cseBreakdown(1500, 550, 1)).toEqual({ tickets: 1, cashCents: 950 })
    expect(cseBreakdown(1500, 550, 5)).toEqual({ tickets: 2, cashCents: 400 })
    expect(cseBreakdown(1500, 550, -1)).toEqual({ tickets: 0, cashCents: 1500 })
  })

  it('is all cash when tickets have no value', () => {
    expect(cseBreakdown(1500, null)).toEqual({ tickets: 0, cashCents: 1500 })
    expect(maxCseTickets(1500, 0)).toBe(0)
  })
})

describe('cseTicketValue', () => {
  const venue = (id: string, cse: number | null, active = true): Venue => ({
    id,
    name: id,
    regularCents: 1300,
    cseTicketCents: cse,
    active,
  })

  it('prefers the default club, then any active club accepting tickets', () => {
    expect(cseTicketValue([venue('a', 600), venue('b', 550)], 'b')).toBe(550)
    expect(cseTicketValue([venue('a', null), venue('b', 550)], 'a')).toBe(550)
    expect(cseTicketValue([venue('a', null), venue('b', 550, false)], 'a')).toBeNull()
  })
})
