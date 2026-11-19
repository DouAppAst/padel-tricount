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
import { useCseTicketValue, useParticipants, useSaveRefund } from '../../data/queries'
import { cseBreakdown, maxCseTickets } from '../../domain/cseTickets'
import { todayIso } from '../../domain/dates'
import type { Transfer } from '../../domain/models'
import { centsToInput, formatCents, parseEuros } from '../../domain/money'
import { breakdownLabel } from './cseLabel'

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
  const ticketValue = useCseTicketValue()
  const [tickets, setTickets] = useState(() =>
    maxCseTickets(initial?.amountCents ?? 0, ticketValue),
  )
  const [settledAt, setSettledAt] = useState(todayIso())
  const [comment, setComment] = useState('')

  const amountCents = parseEuros(amount)
  const maxTickets = maxCseTickets(amountCents ?? 0, ticketValue)
  const breakdown = cseBreakdown(amountCents ?? 0, ticketValue, tickets)

  function changeAmount(input: string) {
    setAmount(input)
    // Suggest paying as much as possible in tickets; the user can lower it.
    setTickets(maxCseTickets(parseEuros(input) ?? 0, ticketValue))
  }
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
      { fromId, toId, amountCents, settledAt, comment, cseTickets: breakdown.tickets },
      {
        onSuccess: () => {
          notify(`Remboursement de ${breakdownLabel(breakdown)} enregistré.`)
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
            onChange={(e) => changeAmount(e.target.value)}
            error={amount !== '' && (amountCents === null || amountCents === 0)}
            slotProps={{
              htmlInput: { inputMode: 'decimal' },
              input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
            }}
          />
          {maxTickets > 0 && (
            <TextField
              label="Dont tickets CSE"
              type="number"
              value={breakdown.tickets}
              onChange={(e) => setTickets(Number(e.target.value))}
              helperText={`${formatCents(breakdown.tickets * (ticketValue ?? 0))} en tickets (${formatCents(ticketValue ?? 0)} l’unité), reste ${formatCents(breakdown.cashCents)} en argent`}
              slotProps={{ htmlInput: { min: 0, max: maxTickets, step: 1 } }}
            />
          )}
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
              {nameOf(fromId)} donne {breakdownLabel(breakdown)} à {nameOf(toId)}
              {breakdown.tickets > 0 ? ` (${formatCents(amountCents)})` : ''}.
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
