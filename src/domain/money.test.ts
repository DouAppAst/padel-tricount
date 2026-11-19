import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, parseEuros } from './money'

describe('parseEuros', () => {
  it.each([
    ['5,50', 550],
    ['5.50', 550],
    ['5,5', 550],
    ['13', 1300],
    ['13,5', 1350],
    [' 13,00 € ', 1300],
    ['0', 0],
    ['0,05', 5],
  ])('%j -> %i', (input, expected) => {
    expect(parseEuros(input)).toBe(expected)
  })

  it.each(['', ',', '-5', '5,555', 'abc', '5,5,5', '1 000,00x', '5,'])('rejects %j', (input) => {
    expect(parseEuros(input)).toBeNull()
  })
})

describe('formatCents', () => {
  it.each([
    [550, '5,50 €'],
    [1300, '13,00 €'],
    [-550, '-5,50 €'],
    [0, '0,00 €'],
  ])('%i -> %s', (cents, expected) => {
    expect(formatCents(cents).replace(/\s/g, ' ')).toBe(expected)
  })

  it('rejects non-integer amounts', () => {
    expect(() => formatCents(5.5)).toThrow(TypeError)
  })
})

describe('centsToInput', () => {
  it.each([
    [550, '5,50'],
    [1305, '13,05'],
    [0, '0,00'],
    [-550, '-5,50'],
  ])('%i -> %s', (cents, expected) => {
    expect(centsToInput(cents)).toBe(expected)
  })

  it('round-trips with parseEuros', () => {
    for (const cents of [0, 5, 99, 550, 1300, 12345]) {
      expect(parseEuros(centsToInput(cents))).toBe(cents)
    }
  })
})
