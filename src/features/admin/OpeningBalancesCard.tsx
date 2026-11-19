import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import { useParticipants, useSaveOpeningDebt, useSettlements } from '../../data/queries'
import { todayIso } from '../../domain/dates'
import { formatCents, parseEuros } from '../../domain/money'
import { SettlementsList } from '../settlements/SettlementsList'

const DEFAULT_COMMENT = 'Reprise du fichier Excel'

/** Admin-only import of the debts computed in the spreadsheet before switching to the app. */
export function OpeningBalancesCard() {
  const settlements = useSettlements()
  const openings = settlements.data?.filter((s) => s.kind === 'OPENING') ?? []

  return (
    <Card>
      <CardHeader
        title="Soldes d’ouverture"
        subheader="Reprise des dettes du fichier Excel à la date de bascule. Saisis la liste simplifiée : « X doit N € à Y »."
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <OpeningDebtForm />
          {settlements.isPending ? (
            <Loading />
          ) : settlements.error ? (
            <ErrorAlert error={settlements.error} onRetry={() => settlements.refetch()} />
          ) : openings.length > 0 ? (
            <SettlementsList settlements={openings} />
          ) : (
            <Typography color="text.secondary">Aucun solde d’ouverture saisi.</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

function OpeningDebtForm() {
  const participants = useParticipants()
  const save = useSaveOpeningDebt()
  const notify = useNotify()
  const [debtorId, setDebtorId] = useState('')
  const [creditorId, setCreditorId] = useState('')
  const [amount, setAmount] = useState('')
  const [settledAt, setSettledAt] = useState(todayIso())
  const [comment, setComment] = useState(DEFAULT_COMMENT)

  const options = participants.data ?? []
  const nameOf = (id: string) => options.find((p) => p.id === id)?.displayName ?? '?'
  const amountCents = parseEuros(amount)
  const samePerson = debtorId !== '' && debtorId === creditorId
  const valid =
    debtorId && creditorId && !samePerson && amountCents !== null && amountCents > 0 && settledAt

  function submit() {
    if (!valid || amountCents === null) return
    save.mutate(
      { debt: { fromId: debtorId, toId: creditorId, amountCents }, settledAt, comment },
      {
        onSuccess: () => {
          notify(`${nameOf(debtorId)} doit ${formatCents(amountCents)} à ${nameOf(creditorId)}.`)
          setDebtorId('')
          setCreditorId('')
          setAmount('')
        },
      },
    )
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          label="Qui doit"
          value={debtorId}
          onChange={(e) => setDebtorId(e.target.value)}
          sx={{ minWidth: 150 }}
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
          sx={{ width: { sm: 130 } }}
        />
        <TextField
          select
          label="À qui"
          value={creditorId}
          onChange={(e) => setCreditorId(e.target.value)}
          error={samePerson}
          helperText={samePerson ? 'Deux personnes différentes' : undefined}
          sx={{ minWidth: 150 }}
        >
          {options.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.displayName}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Date de bascule"
          type="date"
          value={settledAt}
          onChange={(e) => setSettledAt(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Commentaire"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          fullWidth
        />
      </Stack>
      {valid && amountCents !== null && (
        <Alert severity="info" icon={false}>
          {nameOf(debtorId)} doit {formatCents(amountCents)} à {nameOf(creditorId)}.
        </Alert>
      )}
      {save.error && <Alert severity="error">{errorMessage(save.error)}</Alert>}
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={submit} disabled={!valid || save.isPending}>
          Ajouter la dette
        </Button>
      </Stack>
    </Stack>
  )
}
