import { createContext, useContext } from 'react'
import type { ParticipantId } from '../domain/models'

export interface Me {
  participantId: ParticipantId
  displayName: string
  isAdmin: boolean
  email: string
}

export const MeContext = createContext<Me | null>(null)

/** The signed-in member. Only usable below AuthGate. */
export function useMe(): Me {
  const me = useContext(MeContext)
  if (!me) throw new Error('useMe must be used below AuthGate')
  return me
}
