import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { splitEvenly } from '../../domain/gameEntries'
import type { Cents } from '../../domain/models'
import { formatCents, parseEuros } from '../../domain/money'

interface SpecialPriceDialogProps {
  playerCount: number
  /** Amounts for each player, in the displayed order. */
  onApply: (amounts: Cents[]) => void
  onClose: () => void
}

/** One-off price for a session: same price for everyone, or a total split between players. */
export function SpecialPriceDialog({ playerCount, onApply, onClose }: SpecialPriceDialogProps) {
  const [mode, setMode] = useState<'perPerson' | 'total'>('perPerson')
  const [amount, setAmount] = useState('')

  const cents = parseEuros(amount)
  const amounts =
    cents === null
      ? []
      : mode === 'perPerson'
        ? Array<Cents>(playerCount).fill(cents)
        : splitEvenly(cents, playerCount)
  const uneven = new Set(amounts).size > 1

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Prix spécial</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <RadioGroup
            value={mode}
            onChange={(e) => setMode(e.target.value as 'perPerson' | 'total')}
          >
            <FormControlLabel value="perPerson" control={<Radio />} label="Prix par personne" />
            <FormControlLabel
              value="total"
              control={<Radio />}
              label="Total de la session, à partager"
            />
          </RadioGroup>
          <TextField
            autoFocus
            label={mode === 'perPerson' ? 'Prix par personne' : 'Total de la session'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== '' && cents === null}
            slotProps={{
              htmlInput: { inputMode: 'decimal' },
              input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
            }}
          />
          {amounts.length > 0 && (
            <Alert severity="info" icon={false}>
              {uneven
                ? `${amounts.map(formatCents).join(' + ')} (centimes répartis)`
                : `${playerCount} × ${formatCents(amounts[0])} = ${formatCents(
                    amounts.reduce((a, b) => a + b, 0),
                  )}`}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={amounts.length === 0}
          onClick={() => {
            onApply(amounts)
            onClose()
          }}
        >
          Appliquer à tous
        </Button>
      </DialogActions>
    </Dialog>
  )
}
