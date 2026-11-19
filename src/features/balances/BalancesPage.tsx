import {
  Card,
  CardContent,
  CardHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useMe } from '../../app/me'
import { ErrorAlert, Loading } from '../../components/Feedback'
import { BalanceText } from '../../components/Participants'
import { useParticipantName } from '../../components/useParticipantName'
import { useBalances, useParticipants } from '../../data/queries'
import { transfersFor } from '../../domain/debtSimplification'
import type { Transfer } from '../../domain/models'
import { formatCents } from '../../domain/money'
import { TransfersList } from './TransfersList'

const sum = (transfers: Transfer[]) => transfers.reduce((total, t) => total + t.amountCents, 0)

export function BalancesPage() {
  const me = useMe()
  const balances = useBalances()

  if (balances.isPending) return <Loading />
  if (balances.error || !balances.data) return <ErrorAlert error={balances.error} />

  const { transfers } = balances.data
  const mine = transfersFor(transfers, me.participantId)
  const others = transfers.filter(
    (t) => t.fromId !== me.participantId && t.toId !== me.participantId,
  )

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        Soldes
      </Typography>
      <Card>
        <CardHeader title="Mon solde" />
        <CardContent sx={{ pt: 0 }}>
          <MyTotals
            toPay={sum(mine.toPay)}
            toReceive={sum(mine.toReceive)}
            net={balances.data.balances.get(me.participantId)?.netCents ?? 0}
          />
          <TransfersList
            transfers={[...mine.toPay, ...mine.toReceive]}
            empty="Tu es à l’équilibre."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Autres remboursements à faire" />
        <CardContent sx={{ pt: 0 }}>
          <TransfersList transfers={others} empty="Aucun autre remboursement en attente." />
        </CardContent>
      </Card>
      <GroupTable />
    </Stack>
  )
}

export function MyTotals({
  toPay,
  toReceive,
  net,
}: {
  toPay: number
  toReceive: number
  net: number
}) {
  return (
    <Stack spacing={0.5} sx={{ mb: 1 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography>Tu dois payer</Typography>
        <Typography>{formatCents(toPay)}</Typography>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography>Tu dois recevoir</Typography>
        <Typography>{formatCents(toReceive)}</Typography>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 600 }}>Solde net</Typography>
        <BalanceText cents={net} />
      </Stack>
    </Stack>
  )
}

function GroupTable() {
  const balances = useBalances()
  const participants = useParticipants()
  const nameOf = useParticipantName()
  if (!balances.data || !participants.data) return null

  const rows = participants.data
    .filter((p) => p.active || (balances.data!.balances.get(p.id)?.netCents ?? 0) !== 0)
    .map((p) => ({ id: p.id, balance: balances.data!.balances.get(p.id) }))
    .sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), 'fr'))

  return (
    <Card>
      <CardHeader title="Groupe" />
      <TableContainer>
        <Table size="small" aria-label="Soldes du groupe">
          <TableHead>
            <TableRow>
              <TableCell>Participant</TableCell>
              <TableCell align="right">Payé</TableCell>
              <TableCell align="right">Consommé</TableCell>
              <TableCell align="right">Remb. donnés</TableCell>
              <TableCell align="right">Remb. reçus</TableCell>
              <TableCell align="right">Solde</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ id, balance }) => (
              <TableRow key={id}>
                <TableCell>{nameOf(id)}</TableCell>
                <TableCell align="right">{formatCents(balance?.paidCents ?? 0)}</TableCell>
                <TableCell align="right">{formatCents(balance?.consumedCents ?? 0)}</TableCell>
                <TableCell align="right">{formatCents(balance?.refundsSentCents ?? 0)}</TableCell>
                <TableCell align="right">
                  {formatCents(balance?.refundsReceivedCents ?? 0)}
                </TableCell>
                <TableCell align="right">
                  <BalanceText cents={balance?.netCents ?? 0} variant="body2" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}
