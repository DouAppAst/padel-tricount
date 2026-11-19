import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import { useSettings, useUpdateSettings } from '../../data/queries'
import type { AppSettings } from '../../data/repositories/settings'
import { centsToInput, parseEuros } from '../../domain/money'

export function SettingsCard() {
  const settings = useSettings()
  return (
    <Card>
      <CardHeader
        title="Tarifs et lieu"
        subheader="Valeurs proposées pour les nouvelles parties. Les parties déjà enregistrées gardent leur montant."
      />
      <CardContent sx={{ pt: 0 }}>
        {settings.isPending ? (
          <Loading />
        ) : settings.error ? (
          <ErrorAlert error={settings.error} onRetry={() => settings.refetch()} />
        ) : (
          <SettingsForm key={JSON.stringify(settings.data)} initial={settings.data} />
        )}
      </CardContent>
    </Card>
  )
}

function SettingsForm({ initial }: { initial: AppSettings }) {
  const update = useUpdateSettings()
  const notify = useNotify()
  const [cse, setCse] = useState(centsToInput(initial.prices.cseTicketCents))
  const [regular, setRegular] = useState(centsToInput(initial.prices.regularCents))
  const [location, setLocation] = useState(initial.defaultLocation)

  const cseCents = parseEuros(cse)
  const regularCents = parseEuros(regular)
  const valid = cseCents !== null && regularCents !== null && location.trim() !== ''
  const changed =
    cseCents !== initial.prices.cseTicketCents ||
    regularCents !== initial.prices.regularCents ||
    location.trim() !== initial.defaultLocation

  const euroInput = {
    htmlInput: { inputMode: 'decimal' as const },
    input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Ticket CSE"
          value={cse}
          onChange={(e) => setCse(e.target.value)}
          error={cseCents === null}
          slotProps={euroInput}
        />
        <TextField
          label="Tarif classique"
          value={regular}
          onChange={(e) => setRegular(e.target.value)}
          error={regularCents === null}
          slotProps={euroInput}
        />
      </Stack>
      <TextField
        label="Lieu par défaut"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        error={location.trim() === ''}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      {update.error && <Alert severity="error">{errorMessage(update.error)}</Alert>}
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disabled={!valid || !changed || update.isPending}
          onClick={() =>
            valid &&
            update.mutate(
              {
                prices: { cseTicketCents: cseCents, regularCents: regularCents },
                defaultLocation: location,
              },
              { onSuccess: () => notify('Tarifs enregistrés.') },
            )
          }
        >
          Enregistrer
        </Button>
      </Stack>
    </Stack>
  )
}
