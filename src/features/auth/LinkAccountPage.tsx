import {
  Alert,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useLinkableParticipants, useMyStatus, useRequestLink } from '../../data/queries'
import { signOut, type MyStatus } from '../../data/repositories/account'
import { AuthLayout } from './AuthLayout'

interface LinkAccountPageProps {
  status: MyStatus
  email: string
}

export function LinkAccountPage({ status, email }: LinkAccountPageProps) {
  const request = status.lastRequest
  const [choosing, setChoosing] = useState(request?.status !== 'PENDING')

  const deactivated = status.participant && !status.participant.active

  return (
    <AuthLayout title={deactivated ? 'Accès désactivé' : 'Qui es-tu ?'}>
      <Typography variant="body2" color="text.secondary">
        Connecté avec {email}
      </Typography>

      {deactivated ? (
        <Alert severity="warning">
          Ton participant a été désactivé. Contacte un admin pour le réactiver.
        </Alert>
      ) : choosing ? (
        <ChooseParticipant
          rejectedName={request?.status === 'REJECTED' ? request.displayName : undefined}
          onRequested={() => setChoosing(false)}
        />
      ) : (
        <PendingRequest name={request?.displayName ?? ''} onChange={() => setChoosing(true)} />
      )}

      <Button onClick={() => signOut()} color="inherit">
        Se déconnecter
      </Button>
    </AuthLayout>
  )
}

function PendingRequest({ name, onChange }: { name: string; onChange: () => void }) {
  const status = useMyStatus()
  return (
    <>
      <Alert severity="info">
        Demande envoyée pour <strong>{name}</strong>. Un admin doit la valider.
      </Alert>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => status.refetch()} disabled={status.isFetching}>
          Vérifier
        </Button>
        <Button onClick={onChange}>Changer de nom</Button>
      </Stack>
    </>
  )
}

function ChooseParticipant({
  rejectedName,
  onRequested,
}: {
  rejectedName?: string
  onRequested: () => void
}) {
  const linkable = useLinkableParticipants()
  const requestLink = useRequestLink()
  const [selected, setSelected] = useState('')

  if (linkable.isPending) return <Loading />
  if (linkable.error)
    return <ErrorAlert error={linkable.error} onRetry={() => linkable.refetch()} />

  return (
    <>
      {rejectedName && (
        <Alert severity="warning">Ta demande pour {rejectedName} a été refusée.</Alert>
      )}
      {linkable.data.length === 0 ? (
        <Alert severity="info">
          Aucun nom disponible. Demande à un admin de t’ajouter à la liste des participants.
        </Alert>
      ) : (
        <>
          <Typography>Choisis ton nom dans la liste :</Typography>
          <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)}>
            {linkable.data.map((p) => (
              <FormControlLabel key={p.id} value={p.id} control={<Radio />} label={p.displayName} />
            ))}
          </RadioGroup>
          {requestLink.error && <Alert severity="error">{errorMessage(requestLink.error)}</Alert>}
          <Button
            variant="contained"
            disabled={!selected || requestLink.isPending}
            onClick={() => requestLink.mutate(selected, { onSuccess: onRequested })}
          >
            Envoyer la demande
          </Button>
        </>
      )}
      <Button onClick={() => linkable.refetch()} disabled={linkable.isFetching}>
        Actualiser la liste
      </Button>
    </>
  )
}
