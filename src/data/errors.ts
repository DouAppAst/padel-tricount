/** Business error codes raised by the database (see supabase/migrations). */
export const DB_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'NOT_MEMBER',
  'NOT_ADMIN',
  'ALREADY_LINKED',
  'PARTICIPANT_UNAVAILABLE',
  'REQUEST_NOT_FOUND',
  'GAME_NOT_FOUND',
  'SETTLEMENT_NOT_FOUND',
  'NO_PLAYER',
  'LAST_ADMIN',
] as const

export type ApiErrorCode =
  (typeof DB_ERROR_CODES)[number] | 'DUPLICATE' | 'IN_USE' | 'INVALID' | 'UNKNOWN'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

interface PostgrestLikeError {
  message: string
  code?: string
}

export function toApiError(error: PostgrestLikeError): ApiError {
  const known = DB_ERROR_CODES.find((code) => code === error.message)
  if (known) return new ApiError(known, error.message)
  if (error.code === '23505') return new ApiError('DUPLICATE', error.message)
  if (error.code === '23503') return new ApiError('IN_USE', error.message)
  if (error.code === '23514' || error.code === '22023' || error.code === '23502') {
    return new ApiError('INVALID', error.message)
  }
  return new ApiError('UNKNOWN', error.message)
}

/** Returns the data of a Supabase response, throwing an ApiError on failure or empty data. */
export function unwrap<T>(response: { data: T | null; error: PostgrestLikeError | null }): T {
  ensureOk(response)
  if (response.data === null) throw new ApiError('UNKNOWN', 'Empty response')
  return response.data
}

/** For operations without a result (update, delete, void RPC). */
export function ensureOk(response: { error: PostgrestLikeError | null }): void {
  if (response.error) throw toApiError(response.error)
}
