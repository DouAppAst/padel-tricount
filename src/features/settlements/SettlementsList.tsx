import DeleteIcon from '@mui/icons-material/Delete'
import {
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useMe } from '../../app/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { errorMessage } from '../../components/errorMessage'
import { useNotify } from '../../components/notify'
import { useParticipantName } from '../../components/useParticipantName'
import { useSetSettlementDeleted } from '../../data/queries'
import { formatDate } from '../../domain/dates'
import type { Settlement } from '../../domain/models'
import { formatCents } from '../../domain/money'

/** Opening balances are stored reversed (creditor -> debtor), so show them as a debt. */
function describe(settlement: Settlement, nameOf: (id: string) => string): string {
  const amount = formatCents(settlement.amountCents)
  return settlement.kind === 'OPENING'
    ? `${nameOf(settlement.toId)} devait ${amount} à ${nameOf(settlement.fromId)}`
    : `${nameOf(settlement.fromId)} a remboursé ${amount} à ${nameOf(settlement.toId)}`
}

export function SettlementsList({ settlements }: { settlements: Settlement[] }) {
  const me = useMe()
  const nameOf = useParticipantName()
  const notify = useNotify()
  const setDeleted = useSetSettlementDeleted()
  const [deleting, setDeleting] = useState<Settlement | null>(null)

  const visible = settlements.filter((s) => !s.deletedAt)

  function setSettlementDeleted(id: string, deleted: boolean) {
    setDeleted.mutate(
      { id, deleted },
      {
        onSuccess: () => {
          setDeleting(null)
          if (deleted) {
            notify('Remboursement supprimé.', {
              label: 'Annuler',
              onClick: () => setSettlementDeleted(id, false),
            })
          }
        },
        onError: (e) => notify(errorMessage(e)),
      },
    )
  }

  if (visible.length === 0) {
    return <Typography color="text.secondary">Aucun remboursement enregistré.</Typography>
  }

  return (
    <>
      <List disablePadding>
        {visible.map((s) => (
          <ListItem
            key={s.id}
            divider
            disableGutters
            secondaryAction={
              (s.kind === 'REFUND' || me.isAdmin) && (
                <Tooltip title="Supprimer">
                  <IconButton edge="end" aria-label="Supprimer" onClick={() => setDeleting(s)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
                  <span>{describe(s, nameOf)}</span>
                  {s.kind === 'OPENING' && <Chip size="small" label="solde d’ouverture" />}
                </Stack>
              }
              secondary={[formatDate(s.settledAt), s.comment].filter(Boolean).join(' · ')}
            />
          </ListItem>
        ))}
      </List>
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer ce remboursement ?"
        confirmLabel="Supprimer"
        destructive
        busy={setDeleted.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && setSettlementDeleted(deleting.id, true)}
      >
        {deleting && describe(deleting, nameOf)}. Il ne sera plus compté dans les soldes.
      </ConfirmDialog>
    </>
  )
}
