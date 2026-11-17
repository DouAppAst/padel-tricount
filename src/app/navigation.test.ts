import { describe, expect, it } from 'vitest'
import { activeNavPath } from './navigation'

describe('activeNavPath', () => {
  it.each([
    ['/', '/'],
    ['/parties', '/parties'],
    ['/parties/nouvelle', '/parties'],
    ['/soldes', '/soldes'],
    ['/partiesX', '/'],
    ['/inconnu', '/'],
  ])('%s -> %s', (pathname, expected) => {
    expect(activeNavPath(pathname)).toBe(expected)
  })
})
