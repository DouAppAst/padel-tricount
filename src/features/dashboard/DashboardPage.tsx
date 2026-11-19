import AddIcon from '@mui/icons-material/Add'
import { Box, Button, Card, CardContent, CardHeader, Grid, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Link } from 'react-router'
import { useMe } from '../../app/me'
import { NEW_GAME_PATH } from '../../app/navigation'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { BalanceText } from '../../components/Participants'
import { useBalances, useGames } from '../../data/queries'
import { transfersFor } from '../../domain/debtSimplification'
import { TransfersList } from '../balances/TransfersList'
import { GameCard } from '../games/GamesPage'
import { RefundDialog } from '../settlements/RefundDialog'

const RECENT_GAMES = 5

export function DashboardPage() {
  const me = useMe()
  const balances = useBalances()
  const games = useGames()
  const [refunding, setRefunding] = useState(false)

  if (balances.isPending || games.isPending) return <Loading />
  const error = balances.error ?? games.error
  if (error || !balances.data || !games.data) return <ErrorAlert error={error} />

  const mine = transfersFor(balances.data.transfers, me.participantId)
  const net = balances.data.balances.get(me.participantId)?.netCents ?? 0
  const recent = games.data.filter((g) => !g.deletedAt).slice(0, RECENT_GAMES)

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          Salut {me.displayName} 👋
        </Typography>
      </Stack>

      <Button
        variant="contained"
        size="large"
        startIcon={<AddIcon />}
        component={Link}
        to={NEW_GAME_PATH}
        sx={{ py: 1.5, display: { md: 'none' } }}
      >
        Nouvelle partie
      </Button>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Mon solde"
              action={<BalanceText cents={net} variant="h6" sx={{ mr: 1 }} />}
            />
            <CardContent sx={{ pt: 0 }}>
              <TransfersList
                transfers={[...mine.toPay, ...mine.toReceive]}
                empty="Tu es à l’équilibre 🎉"
              />
              <Box sx={{ mt: 1 }}>
                <Button onClick={() => setRefunding(true)}>Enregistrer un remboursement</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Remboursements du groupe" />
            <CardContent sx={{ pt: 0 }}>
              <TransfersList
                transfers={balances.data.transfers}
                empty="Tout le monde est à l’équilibre."
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h3">
          Dernières parties
        </Typography>
        <Button component={Link} to="/parties">
          Tout voir
        </Button>
      </Stack>
      {recent.length === 0 ? (
        <Typography color="text.secondary">
          Aucune partie pour l’instant. Ajoute la première avec « Nouvelle partie ».
        </Typography>
      ) : (
        recent.map((game) => <GameCard key={game.id} game={game} />)
      )}

      {refunding && <RefundDialog onClose={() => setRefunding(false)} />}
    </Stack>
  )
}
