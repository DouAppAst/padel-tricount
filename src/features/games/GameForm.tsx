import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useGames, useParticipants, useSaveGame, useSettings, useVenues } from '../../data/queries'
import type { ParticipantWithAccount } from '../../data/repositories/participants'
import { todayIso } from '../../domain/dates'
import {
  acceptsCse,
  applyPrices,
  changePaymentType,
  gameDebts,
  gameTotal,
  newEntry,
  payerSummaries,
  setCustomAmounts,
  setPaidByForAll,
  setPaymentTypeForAll,
  validateEntries,
  type EntryValidationError,
} from '../../domain/gameEntries'
import {
  PAYMENT_TYPES,
  type Cents,
  type Game,
  type GameEntry,
  type ParticipantId,
  type PaymentType,
  type Prices,
  type Venue,
} from '../../domain/models'
import { centsToInput, formatCents, parseEuros } from '../../domain/money'
import { PAYMENT_LABELS, placesLabel } from './labels'
import { SpecialPriceDialog } from './SpecialPriceDialog'

const VALIDATION_MESSAGES: Record<EntryValidationError, string> = {
  NO_PLAYER: 'Sélectionne au moins un joueur.',
  DUPLICATE_PLAYER: 'Un joueur apparaît deux fois.',
  INVALID_AMOUNT: 'Un montant est invalide.',
  FREE_NOT_ZERO: 'Une place offerte doit valoir 0 €.',
}

const EACH_PAYS = '__each__'

interface GameFormProps {
  /** Game to edit; a new game is created when omitted. */
  game?: Game
  onSaved: (gameId: string) => void
  onCancel: () => void
}

/** Loads what the form needs, then renders it with its initial state. */
export function GameForm(props: GameFormProps) {
  const participants = useParticipants()
  const settings = useSettings()
  const venues = useVenues()
  const games = useGames()

  if (participants.isPending || settings.isPending || venues.isPending || games.isPending) {
    return <Loading />
  }
  const error = participants.error ?? settings.error ?? venues.error ?? games.error
  if (error) return <ErrorAlert error={error} />

  return (
    <GameFormContent
      {...props}
      participants={participants.data ?? []}
      venues={venues.data ?? []}
      defaultVenue={venues.data?.find((v) => v.id === settings.data?.defaultVenueId)}
      lastGame={games.data?.find((g) => !g.deletedAt)}
    />
  )
}

const FALLBACK_PRICES: Prices = { regularCents: 0, cseTicketCents: null }

const findVenue = (venues: Venue[], name: string) =>
  venues.find((v) => v.name.toLowerCase() === name.trim().toLowerCase())

function initialEntries(
  game: Game | undefined,
  participants: ParticipantWithAccount[],
  prices: Prices,
  lastGame: Game | undefined,
): GameEntry[] {
  if (game) return game.entries
  const active = new Set(participants.filter((p) => p.active).map((p) => p.id))
  const entries = (lastGame?.entries ?? [])
    .filter((entry) => active.has(entry.playerId))
    .map((entry) =>
      newEntry(
        entry.playerId,
        entry.paymentType === 'CUSTOM' ? 'CSE_TICKET' : entry.paymentType,
        prices,
      ),
    )
  return applyPrices(entries, prices)
}

function GameFormContent({
  game,
  onSaved,
  onCancel,
  participants,
  venues,
  defaultVenue,
  lastGame,
}: GameFormProps & {
  participants: ParticipantWithAccount[]
  venues: Venue[]
  defaultVenue: Venue | undefined
  lastGame: Game | undefined
}) {
  const saveGame = useSaveGame()

  const [playedAt, setPlayedAt] = useState(game?.playedAt ?? todayIso())
  const [location, setLocation] = useState(game?.location ?? defaultVenue?.name ?? '')
  // Prices of the selected club; an unknown location keeps the previous prices.
  const [prices, setPrices] = useState<Prices>(
    () => (game ? findVenue(venues, game.location) : undefined) ?? defaultVenue ?? FALLBACK_PRICES,
  )
  const [comment, setComment] = useState(game?.comment ?? '')
  const [entries, setEntries] = useState<GameEntry[]>(() =>
    initialEntries(game, participants, prices, lastGame),
  )
  const [specialPriceOpen, setSpecialPriceOpen] = useState(false)
  const [customInputs, setCustomInputs] = useState<Record<ParticipantId, string>>(() =>
    Object.fromEntries(entries.map((e) => [e.playerId, centsToInput(e.amountCents)])),
  )
  const [submitted, setSubmitted] = useState(false)

  const nameOf = (id: ParticipantId) => participants.find((p) => p.id === id)?.displayName ?? '?'
  const byName = (a: ParticipantId, b: ParticipantId) => nameOf(a).localeCompare(nameOf(b), 'fr')

  const inGame = new Set(entries.map((e) => e.playerId))
  // Inactive participants stay selectable when they are already part of an edited game.
  const selectable = participants.filter((p) => p.active || inGame.has(p.id))
  const sortedEntries = [...entries].sort((a, b) => byName(a.playerId, b.playerId))

  const invalidCustom = entries.some(
    (e) => e.paymentType === 'CUSTOM' && parseEuros(customInputs[e.playerId] ?? '') === null,
  )
  const errors = [
    ...validateEntries(entries).map((e) => VALIDATION_MESSAGES[e]),
    ...(invalidCustom ? ['Un montant perso est invalide (ex. 7,50).'] : []),
    ...(playedAt ? [] : ['Choisis une date.']),
  ]

  const recap = useMemo(
    () => ({
      total: gameTotal(entries),
      payers: payerSummaries(entries),
      debts: gameDebts(entries),
    }),
    [entries],
  )

  function togglePlayer(id: ParticipantId) {
    if (inGame.has(id)) {
      setEntries(entries.filter((e) => e.playerId !== id))
      return
    }
    const preferred = acceptsCse(prices) ? 'CSE_TICKET' : 'REGULAR'
    const type =
      !entries[0] || entries[0].paymentType === 'CUSTOM' ? preferred : entries[0].paymentType
    const entry = newEntry(
      id,
      type === 'CSE_TICKET' && !acceptsCse(prices) ? 'REGULAR' : type,
      prices,
    )
    setCustomInputs({ ...customInputs, [id]: centsToInput(entry.amountCents) })
    setEntries([...entries, entry])
  }

  const updateEntry = (playerId: ParticipantId, update: (e: GameEntry) => GameEntry) =>
    setEntries(entries.map((e) => (e.playerId === playerId ? update(e) : e)))

  function setType(playerId: ParticipantId, type: PaymentType) {
    updateEntry(playerId, (e) => {
      const next = changePaymentType(e, type, prices)
      if (type === 'CUSTOM')
        setCustomInputs({ ...customInputs, [playerId]: centsToInput(next.amountCents) })
      return next
    })
  }

  function setCustomAmount(playerId: ParticipantId, input: string) {
    setCustomInputs({ ...customInputs, [playerId]: input })
    const cents = parseEuros(input)
    if (cents !== null) updateEntry(playerId, (e) => ({ ...e, amountCents: cents }))
  }

  function selectLocation(name: string) {
    setLocation(name)
    const venue = findVenue(venues, name)
    if (venue) {
      setPrices(venue)
      setEntries(applyPrices(entries, venue))
    }
  }

  function applySpecialPrice(amounts: Cents[]) {
    // Amounts follow the displayed (alphabetical) order of the players.
    const updated = setCustomAmounts(sortedEntries, amounts)
    setEntries(updated)
    setCustomInputs(
      Object.fromEntries(updated.map((e) => [e.playerId, centsToInput(e.amountCents)])),
    )
  }

  const showCse = acceptsCse(prices) || entries.some((e) => e.paymentType === 'CSE_TICKET')

  function setAllPaidBy(value: string) {
    setEntries(
      value === EACH_PAYS
        ? entries.map((e) => ({ ...e, paidById: e.playerId }))
        : setPaidByForAll(entries, value),
    )
  }

  function save() {
    setSubmitted(true)
    if (errors.length > 0) return
    saveGame.mutate(
      { id: game?.id, playedAt, location, comment, entries },
      { onSuccess: (id) => onSaved(id) },
    )
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
            <Autocomplete
              freeSolo
              fullWidth
              options={venues.filter((v) => v.active).map((v) => v.name)}
              value={location}
              inputValue={location}
              onInputChange={(_, value, reason) =>
                reason === 'input' ? setLocation(value) : undefined
              }
              onChange={(_, value) => selectLocation(value ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Lieu"
                  helperText={`Prix : classique ${formatCents(prices.regularCents)}${
                    prices.cseTicketCents === null
                      ? ', pas de ticket CSE'
                      : `, ticket CSE ${formatCents(prices.cseTicketCents)}`
                  }`}
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: { ...params.slotProps.htmlInput, maxLength: 100 },
                  }}
                />
              )}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Joueurs
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectable.map((p) => (
              <Chip
                key={p.id}
                label={p.displayName}
                color={inGame.has(p.id) ? 'primary' : 'default'}
                variant={inGame.has(p.id) ? 'filled' : 'outlined'}
                onClick={() => togglePlayer(p.id)}
                aria-pressed={inGame.has(p.id)}
                sx={{ minHeight: 40, fontSize: '0.95rem' }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {acceptsCse(prices) && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setEntries(setPaymentTypeForAll(entries, 'CSE_TICKET', prices))}
                  >
                    Tout en ticket CSE
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setEntries(setPaymentTypeForAll(entries, 'REGULAR', prices))}
                >
                  Tout en classique
                </Button>
                <Button variant="outlined" size="small" onClick={() => setSpecialPriceOpen(true)}>
                  Prix spécial…
                </Button>
                <TextField
                  select
                  size="small"
                  label="Tout payé par"
                  value=""
                  onChange={(e) => setAllPaidBy(e.target.value)}
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value={EACH_PAYS}>Chacun sa place</MenuItem>
                  {selectable.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.displayName}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Divider />

              {sortedEntries.map((entry) => (
                <Stack
                  key={entry.playerId}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { md: 'center' } }}
                >
                  <Typography sx={{ fontWeight: 600, minWidth: 110 }}>
                    {nameOf(entry.playerId)}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={entry.paymentType}
                    onChange={(_, type: PaymentType | null) =>
                      type && setType(entry.playerId, type)
                    }
                    aria-label={`Mode de paiement de ${nameOf(entry.playerId)}`}
                  >
                    {PAYMENT_TYPES.filter((type) => type !== 'CSE_TICKET' || showCse).map(
                      (type) => (
                        <ToggleButton key={type} value={type} sx={{ px: 1.5 }}>
                          {PAYMENT_LABELS[type]}
                        </ToggleButton>
                      ),
                    )}
                  </ToggleButtonGroup>
                  {entry.paymentType === 'CUSTOM' ? (
                    <TextField
                      size="small"
                      label="Montant"
                      value={customInputs[entry.playerId] ?? ''}
                      onChange={(e) => setCustomAmount(entry.playerId, e.target.value)}
                      error={parseEuros(customInputs[entry.playerId] ?? '') === null}
                      slotProps={{
                        htmlInput: { inputMode: 'decimal' },
                        input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
                      }}
                      sx={{ width: 120 }}
                    />
                  ) : (
                    <Typography sx={{ minWidth: 70 }}>{formatCents(entry.amountCents)}</Typography>
                  )}
                  <TextField
                    select
                    size="small"
                    label="Payé par"
                    value={entry.paidById}
                    onChange={(e) =>
                      updateEntry(entry.playerId, (x) => ({ ...x, paidById: e.target.value }))
                    }
                    sx={{ minWidth: 150 }}
                  >
                    {selectable.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.displayName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <Card sx={{ bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Récapitulatif · Total {formatCents(recap.total)}
            </Typography>
            {recap.payers.map((payer) => (
              <Typography key={payer.payerId}>
                {nameOf(payer.payerId)} a payé {placesLabel(payer.places)} :{' '}
                {formatCents(payer.amountCents)}
              </Typography>
            ))}
            <Box sx={{ mt: 1 }}>
              {recap.debts.length === 0 ? (
                <Typography color="text.secondary">
                  Personne ne doit rien pour cette partie.
                </Typography>
              ) : (
                recap.debts.map((debt) => (
                  <Typography key={`${debt.fromId}-${debt.toId}`} sx={{ fontWeight: 600 }}>
                    {nameOf(debt.fromId)} doit {formatCents(debt.amountCents)} à {nameOf(debt.toId)}
                  </Typography>
                ))
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <TextField
        label="Commentaire (optionnel)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        multiline
      />

      {submitted && errors.length > 0 && (
        <Alert severity="warning">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Alert>
      )}
      {saveGame.error && <Alert severity="error">{errorMessage(saveGame.error)}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Annuler</Button>
        <Button variant="contained" size="large" onClick={save} disabled={saveGame.isPending}>
          {game ? 'Enregistrer les modifications' : 'Enregistrer la partie'}
        </Button>
      </Stack>

      {specialPriceOpen && (
        <SpecialPriceDialog
          playerCount={entries.length}
          onApply={applySpecialPrice}
          onClose={() => setSpecialPriceOpen(false)}
        />
      )}
    </Stack>
  )
}
