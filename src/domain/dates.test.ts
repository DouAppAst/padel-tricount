import { describe, expect, it } from 'vitest'
import { formatDate, todayIso } from './dates'

describe('dates', () => {
  it('todayIso uses the local calendar day', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('formatDate is not shifted by time zones', () => {
    expect(formatDate('2026-11-19')).toMatch(/19 nov\.? 2026/)
    expect(formatDate('2026-01-01T00:00:00Z')).toMatch(/1 janv\.? 2026/)
  })
})
