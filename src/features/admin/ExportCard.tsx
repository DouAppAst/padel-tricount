import DownloadIcon from '@mui/icons-material/Download'
import { Alert, Button, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { useNotify } from '../../components/notify'
import { unwrap } from '../../data/errors'
import { supabase } from '../../data/supabaseClient'
import { todayIso } from '../../domain/dates'
import { gamesCsv, settlementsCsv } from '../../domain/exportCsv'
import { listGames } from '../../data/repositories/games'
import { listParticipants } from '../../data/repositories/participants'
import { listSettlements } from '../../data/repositories/settlements'

const TABLES = [
  'participants',
  'venues',
  'settings',
  'games',
  'game_entries',
  'settlements',
  'link_requests',
] as const

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Raw copy of every table, including soft-deleted rows, for a manual backup. */
async function exportJson() {
  const tables: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    tables[table] = unwrap(await supabase().from(table).select('*'))
  }
  const backup = { app: 'padel-tricount', exportedAt: new Date().toISOString(), tables }
  download(`padel-tricount-${todayIso()}.json`, JSON.stringify(backup, null, 2), 'application/json')
}

async function exportCsv() {
  const [games, settlements, participants] = await Promise.all([
    listGames(),
    listSettlements(),
    listParticipants(),
  ])
  const names = new Map(participants.map((p) => [p.id, p.displayName]))
  const nameOf = (id: string | null | undefined) => (id && names.get(id)) || '?'
  download(`padel-parties-${todayIso()}.csv`, gamesCsv(games, nameOf), 'text/csv')
  download(
    `padel-remboursements-${todayIso()}.csv`,
    settlementsCsv(settlements, nameOf),
    'text/csv',
  )
}

export function ExportCard() {
  const notify = useNotify()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      notify('Export téléchargé.')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Sauvegarde" />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Une sauvegarde chiffrée automatique est faite tous les 3 jours. Ces exports permettent
            en plus d’en garder une copie chez toi.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              disabled={busy}
              onClick={() => run(exportJson)}
            >
              Sauvegarde complète (JSON)
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              disabled={busy}
              onClick={() => run(exportCsv)}
            >
              Parties et remboursements (Excel)
            </Button>
          </Stack>
          {error !== null && <Alert severity="error">{errorMessage(error)}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  )
}
