import { Button, List, ListItem, ListItemText, Typography } from '@mui/material'
import { useState } from 'react'
import type { Transfer } from '../../domain/models'
import { RefundDialog } from '../settlements/RefundDialog'
import { useTransferSentence } from './useTransferSentence'

export function TransfersList({ transfers, empty }: { transfers: Transfer[]; empty: string }) {
  const sentence = useTransferSentence()
  const [refunding, setRefunding] = useState<Transfer | null>(null)

  if (transfers.length === 0) return <Typography color="text.secondary">{empty}</Typography>

  return (
    <>
      <List disablePadding>
        {transfers.map((t) => (
          <ListItem key={`${t.fromId}-${t.toId}`} disableGutters divider sx={{ gap: 1 }}>
            <ListItemText primary={sentence(t)} />
            <Button size="small" onClick={() => setRefunding(t)} sx={{ flexShrink: 0 }}>
              Marquer comme remboursé
            </Button>
          </ListItem>
        ))}
      </List>
      {refunding && <RefundDialog initial={refunding} onClose={() => setRefunding(null)} />}
    </>
  )
}
