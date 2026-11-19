import { useMe } from '../../app/me'
import { useParticipantName } from '../../components/useParticipantName'
import type { Transfer } from '../../domain/models'
import { formatCents } from '../../domain/money'

/** "Tu dois 5,50 € à Bruno", "Chloé te doit 5,50 €" or "Chloé doit 5,50 € à Bruno". */
export function useTransferSentence() {
  const me = useMe()
  const nameOf = useParticipantName()
  return (t: Transfer) => {
    const amount = formatCents(t.amountCents)
    if (t.fromId === me.participantId) return `Tu dois ${amount} à ${nameOf(t.toId)}`
    if (t.toId === me.participantId) return `${nameOf(t.fromId)} te doit ${amount}`
    return `${nameOf(t.fromId)} doit ${amount} à ${nameOf(t.toId)}`
  }
}
