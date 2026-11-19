import { Alert, Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import { useGames } from '../../data/queries'
import { GameForm } from './GameForm'

export function EditGamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const games = useGames()

  if (games.isPending) return <Loading />
  if (games.error) return <ErrorAlert error={games.error} onRetry={() => games.refetch()} />
  const game = games.data.find((g) => g.id === gameId && !g.deletedAt)
  if (!game) return <Alert severity="warning">Cette partie n’existe plus ou a été supprimée.</Alert>

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        Modifier la partie
      </Typography>
      <GameForm
        game={game}
        onSaved={(id) => {
          notify('Partie modifiée.')
          navigate(`/parties/${id}`, { replace: true })
        }}
        onCancel={() => navigate(-1)}
      />
    </Stack>
  )
}
