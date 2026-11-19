import { describe, expect, it } from 'vitest'
import { ApiError, toApiError, unwrap } from './errors'

describe('toApiError', () => {
  it.each([
    [{ message: 'NOT_ADMIN', code: '42501' }, 'NOT_ADMIN'],
    [{ message: 'LAST_ADMIN', code: 'P0001' }, 'LAST_ADMIN'],
    [{ message: 'duplicate key value violates unique constraint', code: '23505' }, 'DUPLICATE'],
    [{ message: 'new row violates check constraint', code: '23514' }, 'INVALID'],
    [{ message: 'permission denied for table games', code: '42501' }, 'UNKNOWN'],
  ])('%j -> %s', (error, code) => {
    expect(toApiError(error).code).toBe(code)
  })
})

describe('unwrap', () => {
  it('returns data or throws an ApiError', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1)
    expect(() => unwrap({ data: null, error: { message: 'NOT_MEMBER' } })).toThrow(ApiError)
    expect(() => unwrap({ data: null, error: null })).toThrow('Empty response')
  })
})
