import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ErrorAlert, Loading } from '../components/Feedback'
import { useMyStatus } from '../data/queries'
import { getSession, onSessionChange } from '../data/repositories/account'
import { LinkAccountPage } from '../features/auth/LinkAccountPage'
import { LoginPage } from '../features/auth/LoginPage'
import { MeContext } from './me'

/** Shows the login page, then the "who are you?" page, until the user is a linked member. */
export function AuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const userId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const apply = (next: Session | null) => {
      if (next?.user.id !== userId.current) {
        // Another user (or none): never show cached data from the previous one.
        queryClient.clear()
        userId.current = next?.user.id
      }
      setSession(next)
    }
    getSession().then(apply, () => apply(null))
    return onSessionChange(apply)
  }, [queryClient])

  if (session === undefined) return <Loading />
  if (session === null) return <LoginPage />
  return <MemberGate email={session.user.email ?? ''}>{children}</MemberGate>
}

function MemberGate({ email, children }: { email: string; children: ReactNode }) {
  const status = useMyStatus()

  if (status.isPending) return <Loading />
  if (status.error) return <ErrorAlert error={status.error} onRetry={() => status.refetch()} />

  const participant = status.data.participant
  if (!participant || !participant.active) {
    return <LinkAccountPage status={status.data} email={email} />
  }

  return (
    <MeContext.Provider
      value={{
        participantId: participant.id,
        displayName: participant.displayName,
        isAdmin: participant.isAdmin,
        email,
      }}
    >
      {children}
    </MeContext.Provider>
  )
}
