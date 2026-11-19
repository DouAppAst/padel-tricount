import type { Cents } from './models'

const EURO_INPUT = /^(\d{1,6})(?:[.,](\d{1,2}))?$/

const formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/**
 * Parses a user-typed euro amount ("5,50", "5.5", "13", "13 €") into cents.
 * Returns null for anything invalid, negative or with more than two decimals.
 */
export function parseEuros(input: string): Cents | null {
  const normalized = input.replace(/€/g, '').replace(/\s/g, '')
  const match = EURO_INPUT.exec(normalized)
  if (!match) return null
  const [, euros, decimals = ''] = match
  return Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
}

export function formatCents(cents: Cents): string {
  assertCents(cents)
  return formatter.format(cents / 100)
}

/** Euro amount without currency symbol, suitable to pre-fill an input ("5,50"). */
export function centsToInput(cents: Cents): string {
  assertCents(cents)
  const abs = Math.abs(cents)
  const sign = cents < 0 ? '-' : ''
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function assertCents(value: unknown): asserts value is Cents {
  if (!isCents(value)) throw new TypeError(`Invalid cents amount: ${String(value)}`)
}
