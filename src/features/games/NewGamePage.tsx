import { Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router'
import { useNotify } from '../../components/notify'
import { GameForm } from './GameForm'

export function NewGamePage() {
  const navigate = useNavigate()
  const notify = useNotify()
  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        Nouvelle partie
      </Typography>
      <GameForm
        onSaved={() => {
          notify('Partie enregistrée.')
          navigate('/')
        }}
        onCancel={() => navigate(-1)}
      />
    </Stack>
  )
}
