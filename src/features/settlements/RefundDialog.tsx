import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { useNotify } from '../../components/notify'
import { useParticipants, useSaveRefund } from '../../data/queries'
import { todayIso } from '../../domain/dates'
import type { Transfer } from '../../domain/models'
import { centsToInput, formatCents, parseEuros } from '../../domain/money'

interface RefundDialogProps {
  /** Pre-filled values, e.g. from a suggested transfer. */
  initial?: Partial<Transfer>
  onClose: () => void
}

/** Records money actually handed over. Render it only while it is open. */
export function RefundDialog({ initial, onClose }: RefundDialogProps) {
  const participants = useParticipants()
  const saveRefund = useSaveRefund()
  const notify = useNotify()
  const [fromId, setFromId] = useState(initial?.fromId ?? '')
  const [toId, setToId] = useState(initial?.toId ?? '')
  const [amount, setAmount] = useState(
    initial?.amountCents ? centsToInput(initial.amountCents) : '',
  )
  const [settledAt, setSettledAt] = useState(todayIso())
  const [comment, setComment] = useState('')

  const amountCents = parseEuros(amount)
  const sameperson = fromId !== '' && fromId === toId
  const valid =
    fromId && toId && !sameperson && amountCents !== null && amountCents > 0 && settledAt
  const options = (participants.data ?? []).filter(
    (p) => p.active || p.id === fromId || p.id === toId,
  )
  const nameOf = (id: string) => options.find((p) => p.id === id)?.displayName ?? '?'

  function save() {
    if (!valid || amountCents === null) return
    saveRefund.mutate(
      { fromId, toId, amountCents, settledAt, comment },
      {
        onSuccess: () => {
          notify(`Remboursement de ${formatCents(amountCents)} enregistré.`)
          onClose()
        },
      },
    )
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Enregistrer un remboursement</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Qui paie"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          >
            {options.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Qui reçoit"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            error={sameperson}
            helperText={sameperson ? 'Choisis deux personnes différentes.' : undefined}
          >
            {options.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== '' && (amountCents === null || amountCents === 0)}
            slotProps={{
              htmlInput: { inputMode: 'decimal' },
              input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
            }}
          />
          <TextField
            label="Date"
            type="date"
            value={settledAt}
            onChange={(e) => setSettledAt(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          {valid && amountCents !== null && (
            <Alert severity="info" icon={false}>
              {nameOf(fromId)} donne {formatCents(amountCents)} à {nameOf(toId)}.
            </Alert>
          )}
          {saveRefund.error && <Alert severity="error">{errorMessage(saveRefund.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={!valid || saveRefund.isPending}>
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  )
}
