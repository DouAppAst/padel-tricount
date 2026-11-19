import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState, type FormEvent } from 'react'
import { useMe } from '../../app/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import { useParticipantName } from '../../components/useParticipantName'
import {
  useApproveLink,
  useCreateParticipant,
  useParticipants,
  usePendingLinkRequests,
  useRejectLink,
  useUpdateParticipant,
} from '../../data/queries'
import type { ParticipantWithAccount } from '../../data/repositories/participants'
import { formatDate } from '../../domain/dates'
import { OpeningBalancesCard } from './OpeningBalancesCard'
import { SettingsCard } from './SettingsCard'

export function AdminPage() {
  const me = useMe()
  if (!me.isAdmin) return <Alert severity="warning">Cette page est réservée aux admins.</Alert>
  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        Administration
      </Typography>
      <LinkRequestsCard />
      <ParticipantsCard />
      <SettingsCard />
      <OpeningBalancesCard />
    </Stack>
  )
}

function LinkRequestsCard() {
  const requests = usePendingLinkRequests(true)
  const approve = useApproveLink()
  const reject = useRejectLink()
  const nameOf = useParticipantName()
  const notify = useNotify()

  const onError = (error: unknown) => notify(errorMessage(error))

  return (
    <Card>
      <CardHeader title="Demandes d’accès" subheader="Comptes qui demandent à être liés à un nom" />
      <CardContent sx={{ pt: 0 }}>
        {requests.isPending ? (
          <Loading />
        ) : requests.error ? (
          <ErrorAlert error={requests.error} onRetry={() => requests.refetch()} />
        ) : requests.data.length === 0 ? (
          <Typography color="text.secondary">Aucune demande en attente.</Typography>
        ) : (
          <List disablePadding>
            {requests.data.map((request) => (
              <ListItem key={request.id} disableGutters divider sx={{ flexWrap: 'wrap', gap: 1 }}>
                <ListItemText
                  primary={nameOf(request.participantId)}
                  secondary={`${request.requesterEmail ?? 'email inconnu'} · ${formatDate(request.createdAt)}`}
                  sx={{ minWidth: 180 }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => reject.mutate(request.id, { onError })}
                    disabled={reject.isPending}
                  >
                    Refuser
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      approve.mutate(request.id, {
                        onError,
                        onSuccess: () => notify(`${nameOf(request.participantId)} a accès.`),
                      })
                    }
                    disabled={approve.isPending}
                  >
                    Valider
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  )
}

function ParticipantsCard() {
  const participants = useParticipants()
  const create = useCreateParticipant()
  const update = useUpdateParticipant()
  const notify = useNotify()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<ParticipantWithAccount | null>(null)
  const [unlinking, setUnlinking] = useState<ParticipantWithAccount | null>(null)

  const onError = (error: unknown) => notify(errorMessage(error))

  function add(event: FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    create.mutate(name, {
      onSuccess: () => {
        setNewName('')
        notify(`${name} ajouté.`)
      },
      onError,
    })
  }

  return (
    <Card>
      <CardHeader title="Participants" />
      <CardContent sx={{ pt: 0 }}>
        <Stack component="form" direction="row" spacing={1} onSubmit={add} sx={{ mb: 2 }}>
          <TextField
            label="Nouveau participant"
            size="small"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!newName.trim() || create.isPending}
          >
            Ajouter
          </Button>
        </Stack>

        {participants.isPending ? (
          <Loading />
        ) : participants.error ? (
          <ErrorAlert error={participants.error} onRetry={() => participants.refetch()} />
        ) : (
          <List disablePadding>
            {participants.data.map((p) => (
              <ListItem key={p.id} disableGutters divider sx={{ flexWrap: 'wrap', gap: 1 }}>
                <ListItemText
                  primary={
                    <Stack
                      direction="row"
                      spacing={1}
                      component="span"
                      sx={{ alignItems: 'center' }}
                    >
                      <span>{p.displayName}</span>
                      {p.isAdmin && <Chip size="small" label="admin" color="primary" />}
                      {!p.active && <Chip size="small" label="inactif" />}
                    </Stack>
                  }
                  secondary={p.hasAccount ? 'Compte lié' : 'Pas de compte lié'}
                  sx={{ minWidth: 160 }}
                />
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={p.active}
                        onChange={(e) =>
                          update.mutate(
                            { id: p.id, patch: { active: e.target.checked } },
                            { onError },
                          )
                        }
                      />
                    }
                    label="Actif"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={p.isAdmin}
                        onChange={(e) =>
                          update.mutate(
                            { id: p.id, patch: { isAdmin: e.target.checked } },
                            { onError },
                          )
                        }
                      />
                    }
                    label="Admin"
                  />
                  <Tooltip title="Renommer">
                    <IconButton
                      aria-label={`Renommer ${p.displayName}`}
                      onClick={() => setEditing(p)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {p.hasAccount && (
                    <Tooltip title="Délier le compte">
                      <IconButton
                        aria-label={`Délier le compte de ${p.displayName}`}
                        onClick={() => setUnlinking(p)}
                      >
                        <LinkOffIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>

      {editing && <RenameDialog participant={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={unlinking !== null}
        title="Délier le compte ?"
        confirmLabel="Délier"
        destructive
        busy={update.isPending}
        onClose={() => setUnlinking(null)}
        onConfirm={() =>
          unlinking &&
          update.mutate(
            { id: unlinking.id, patch: { unlinkAccount: true } },
            { onError, onSettled: () => setUnlinking(null) },
          )
        }
      >
        Le compte de {unlinking?.displayName} n’aura plus accès à l’application. L’historique est
        conservé et un nouveau compte pourra demander ce nom.
      </ConfirmDialog>
    </Card>
  )
}

function RenameDialog({
  participant,
  onClose,
}: {
  participant: ParticipantWithAccount
  onClose: () => void
}) {
  const update = useUpdateParticipant()
  const [name, setName] = useState(participant.displayName)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Renommer</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          error={error !== null}
          helperText={error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || update.isPending}
          onClick={() =>
            update.mutate(
              { id: participant.id, patch: { displayName: name } },
              { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) },
            )
          }
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  )
}
