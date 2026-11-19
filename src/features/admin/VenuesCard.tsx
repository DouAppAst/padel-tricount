import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material'
import { useState } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { useNotify } from '../../components/notify'
import {
  useCreateVenue,
  useSetDefaultVenue,
  useSetVenueActive,
  useSettings,
  useUpdateVenue,
  useVenues,
} from '../../data/queries'
import type { Venue } from '../../domain/models'
import { centsToInput, parseEuros } from '../../domain/money'
import { venuePricesLabel } from './venueLabel'

export function VenuesCard() {
  const venues = useVenues()
  const settings = useSettings()
  const setDefault = useSetDefaultVenue()
  const setActive = useSetVenueActive()
  const notify = useNotify()
  const [editing, setEditing] = useState<Venue | 'new' | null>(null)

  const onError = (error: unknown) => notify(errorMessage(error))
  const defaultId = settings.data?.defaultVenueId

  return (
    <Card>
      <CardHeader
        title="Clubs et tarifs"
        subheader="Prix proposés à la saisie d’une partie. Les parties déjà enregistrées gardent leur montant."
        action={
          <Button startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            Ajouter
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {venues.isPending || settings.isPending ? (
          <Loading />
        ) : venues.error || settings.error ? (
          <ErrorAlert error={venues.error ?? settings.error} onRetry={() => venues.refetch()} />
        ) : (
          <List disablePadding>
            {venues.data.map((venue) => {
              const isDefault = venue.id === defaultId
              return (
                <ListItem key={venue.id} disableGutters divider sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        spacing={1}
                        component="span"
                        sx={{ alignItems: 'center' }}
                      >
                        <span>{venue.name}</span>
                        {isDefault && <Chip size="small" color="primary" label="par défaut" />}
                        {!venue.active && <Chip size="small" label="inactif" />}
                      </Stack>
                    }
                    secondary={venuePricesLabel(venue)}
                    sx={{ minWidth: 200 }}
                  />
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    {!isDefault && venue.active && (
                      <Button
                        size="small"
                        onClick={() => setDefault.mutate(venue.id, { onError })}
                        disabled={setDefault.isPending}
                      >
                        Par défaut
                      </Button>
                    )}
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={venue.active}
                          disabled={isDefault}
                          onChange={(e) =>
                            setActive.mutate(
                              { id: venue.id, active: e.target.checked },
                              { onError },
                            )
                          }
                        />
                      }
                      label="Actif"
                    />
                    <Tooltip title="Modifier">
                      <IconButton
                        aria-label={`Modifier ${venue.name}`}
                        onClick={() => setEditing(venue)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItem>
              )
            })}
          </List>
        )}
      </CardContent>
      {editing && (
        <VenueDialog
          venue={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

function VenueDialog({ venue, onClose }: { venue?: Venue; onClose: () => void }) {
  const create = useCreateVenue()
  const update = useUpdateVenue()
  const notify = useNotify()
  const [name, setName] = useState(venue?.name ?? '')
  const [regular, setRegular] = useState(venue ? centsToInput(venue.regularCents) : '')
  const [acceptsCse, setAcceptsCse] = useState(venue ? venue.cseTicketCents !== null : false)
  const [cse, setCse] = useState(
    venue?.cseTicketCents != null ? centsToInput(venue.cseTicketCents) : '',
  )

  const regularCents = parseEuros(regular)
  const cseCents = acceptsCse ? parseEuros(cse) : null
  const valid = name.trim() !== '' && regularCents !== null && (!acceptsCse || cseCents !== null)
  const mutation = venue ? update : create

  const euroInput = {
    htmlInput: { inputMode: 'decimal' as const },
    input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
  }

  function save() {
    if (!valid || regularCents === null) return
    const input = { name, regularCents, cseTicketCents: cseCents }
    const options = {
      onSuccess: () => {
        notify(venue ? 'Club modifié.' : 'Club ajouté.')
        onClose()
      },
    }
    if (venue) update.mutate({ id: venue.id, input }, options)
    else create.mutate(input, options)
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{venue ? 'Modifier le club' : 'Nouveau club'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            autoFocus
          />
          <TextField
            label="Tarif classique par personne"
            value={regular}
            onChange={(e) => setRegular(e.target.value)}
            error={regular !== '' && regularCents === null}
            slotProps={euroInput}
          />
          <FormControlLabel
            control={
              <Checkbox checked={acceptsCse} onChange={(e) => setAcceptsCse(e.target.checked)} />
            }
            label="Accepte les tickets CSE"
          />
          {acceptsCse && (
            <TextField
              label="Prix avec ticket CSE"
              value={cse}
              onChange={(e) => setCse(e.target.value)}
              error={cse !== '' && cseCents === null}
              slotProps={euroInput}
            />
          )}
          {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={!valid || mutation.isPending}>
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  )
}
