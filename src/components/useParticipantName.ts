import { useCallback } from 'react'
import { useParticipants } from '../data/queries'
import type { ParticipantId } from '../domain/models'

/** Returns a resolver from participant id to display name. */
export function useParticipantName() {
  const { data } = useParticipants()
  return useCallback(
    (id: ParticipantId | null | undefined) =>
      (id && data?.find((p) => p.id === id)?.displayName) ?? '?',
    [data],
  )
}
