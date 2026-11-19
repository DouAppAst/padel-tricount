import AddIcon from '@mui/icons-material/Add'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useParticipantName } from '../../components/useParticipantName'
import { useGames, useSettlements } from '../../data/queries'
import { formatDate } from '../../domain/dates'
import { gameTotal } from '../../domain/gameEntries'
import type { Game } from '../../domain/models'
import { formatCents } from '../../domain/money'
import { RefundDialog } from '../settlements/RefundDialog'
import { SettlementsList } from '../settlements/SettlementsList'
import { paymentTypesSummary } from './labels'

const PAGE_SIZE = 30

export function GamesPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('vue') === 'remboursements' ? 'settlements' : 'games'

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        Historique
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, value) => setParams(value === 'settlements' ? { vue: 'remboursements' } : {})}
      >
        <Tab value="games" label="Parties" />
        <Tab value="settlements" label="Remboursements" />
      </Tabs>
      {tab === 'games' ? <GamesHistory /> : <SettlementsHistory />}
    </Stack>
  )
}

function GamesHistory() {
  const games = useGames()
  const [showDeleted, setShowDeleted] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)

  if (games.isPending) return <Loading />
  if (games.error) return <ErrorAlert error={games.error} onRetry={() => games.refetch()} />

  const visible = games.data.filter((g) => showDeleted || !g.deletedAt)
  const hasDeleted = games.data.some((g) => g.deletedAt)

  return (
    <Stack spacing={1.5}>
      {hasDeleted && (
        <FormControlLabel
          control={
            <Switch checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          }
          label="Afficher les parties supprimées"
        />
      )}
      {visible.length === 0 && (
        <Typography color="text.secondary">Aucune partie pour l’instant.</Typography>
      )}
      {visible.slice(0, limit).map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
      {visible.length > limit && (
        <Button onClick={() => setLimit(limit + PAGE_SIZE)}>Voir plus</Button>
      )}
    </Stack>
  )
}

export function GameCard({ game }: { game: Game }) {
  const nameOf = useParticipantName()
  const players = game.entries
    .map((e) => nameOf(e.playerId))
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .join(', ')

  return (
    <Card sx={{ opacity: game.deletedAt ? 0.6 : 1 }}>
      <CardActionArea component={Link} to={`/parties/${game.id}`}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 600 }}>
              {formatDate(game.playedAt)}
              {game.deletedAt ? ' · supprimée' : ''}
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{formatCents(gameTotal(game.entries))}</Typography>
          </Stack>
          <Typography variant="body2">{players}</Typography>
          <Typography variant="body2" color="text.secondary">
            {game.location} · {paymentTypesSummary(game.entries)}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

function SettlementsHistory() {
  const settlements = useSettlements()
  const [adding, setAdding] = useState(false)

  if (settlements.isPending) return <Loading />
  if (settlements.error) {
    return <ErrorAlert error={settlements.error} onRetry={() => settlements.refetch()} />
  }

  return (
    <Stack spacing={1.5}>
      <Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
          Enregistrer un remboursement
        </Button>
      </Box>
      <Card>
        <CardContent>
          <SettlementsList settlements={settlements.data} />
        </CardContent>
      </Card>
      {adding && <RefundDialog onClose={() => setAdding(false)} />}
    </Stack>
  )
}
