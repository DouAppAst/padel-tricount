import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import { useParticipantName } from '../../components/useParticipantName'
import { useGames, useSetGameDeleted } from '../../data/queries'
import { formatDate } from '../../domain/dates'
import { gameDebts, gameTotal } from '../../domain/gameEntries'
import { formatCents } from '../../domain/money'
import { PAYMENT_LABELS } from './labels'

export function GameDetailPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const nameOf = useParticipantName()
  const games = useGames()
  const setDeleted = useSetGameDeleted()
  const [confirming, setConfirming] = useState(false)

  if (games.isPending) return <Loading />
  if (games.error) return <ErrorAlert error={games.error} onRetry={() => games.refetch()} />
  const game = games.data.find((g) => g.id === gameId)
  if (!game) return <Alert severity="warning">Cette partie n’existe pas.</Alert>

  const entries = [...game.entries].sort((a, b) =>
    nameOf(a.playerId).localeCompare(nameOf(b.playerId), 'fr'),
  )
  const debts = gameDebts(game.entries)

  function setGameDeleted(deleted: boolean) {
    setDeleted.mutate(
      { id: game!.id, deleted },
      {
        onSuccess: () => {
          setConfirming(false)
          if (deleted) {
            notify('Partie supprimée.', { label: 'Annuler', onClick: () => setGameDeleted(false) })
            navigate('/parties')
          } else {
            notify('Partie restaurée.')
          }
        },
        onError: (e) => notify(errorMessage(e)),
      },
    )
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button component={Link} to="/parties" startIcon={<ArrowBackIcon />}>
          Parties
        </Button>
      </Stack>
      <Typography variant="h5" component="h2">
        {formatDate(game.playedAt)}
      </Typography>
      <Typography color="text.secondary">
        {game.location} · Total {formatCents(gameTotal(game.entries))}
      </Typography>

      {game.deletedAt && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => setGameDeleted(false)}>
              Restaurer
            </Button>
          }
        >
          Cette partie a été supprimée : elle n’est plus comptée dans les soldes.
        </Alert>
      )}

      <Card>
        <Table size="small" aria-label="Places de la partie">
          <TableHead>
            <TableRow>
              <TableCell>Joueur</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell>Payé par</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.playerId}>
                <TableCell>{nameOf(entry.playerId)}</TableCell>
                <TableCell>{PAYMENT_LABELS[entry.paymentType]}</TableCell>
                <TableCell align="right">{formatCents(entry.amountCents)}</TableCell>
                <TableCell>{nameOf(entry.paidById)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardContent>
          {debts.length === 0 ? (
            <Typography color="text.secondary">Chacun a payé sa place.</Typography>
          ) : (
            debts.map((debt) => (
              <Typography key={`${debt.fromId}-${debt.toId}`}>
                {nameOf(debt.fromId)} doit {formatCents(debt.amountCents)} à {nameOf(debt.toId)}
              </Typography>
            ))
          )}
        </CardContent>
      </Card>

      {game.comment && <Typography>« {game.comment} »</Typography>}
      <Typography variant="body2" color="text.secondary">
        Ajoutée par {nameOf(game.createdById)}
        {game.updatedById && game.updatedAt
          ? ` · modifiée par ${nameOf(game.updatedById)} le ${formatDate(game.updatedAt)}`
          : ''}
      </Typography>

      {!game.deletedAt && (
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            component={Link}
            to={`/parties/${game.id}/modifier`}
          >
            Modifier
          </Button>
          <Button color="error" startIcon={<DeleteIcon />} onClick={() => setConfirming(true)}>
            Supprimer
          </Button>
        </Stack>
      )}

      <ConfirmDialog
        open={confirming}
        title="Supprimer cette partie ?"
        confirmLabel="Supprimer"
        destructive
        busy={setDeleted.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => setGameDeleted(true)}
      >
        Elle ne sera plus comptée dans les soldes. Tu pourras l’annuler juste après.
      </ConfirmDialog>
    </Stack>
  )
}
