import { centsToInput } from './money'
import type { Game, Settlement } from './models'

const PAYMENT_LABELS = {
  CSE_TICKET: 'Ticket CSE',
  REGULAR: 'Classique',
  FREE: 'Offert',
  CUSTOM: 'Perso',
} as const

/** CSV cell for a French Excel: ";" separator, quotes doubled. */
function cell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  // The BOM makes Excel read the file as UTF-8 (accents in names).
  return '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

type NameOf = (id: string | null | undefined) => string

/** One line per player and game, readable in Excel. Deleted games are flagged, not dropped. */
export function gamesCsv(games: readonly Game[], nameOf: NameOf): string {
  const rows: (string | number | null)[][] = [
    ['Date', 'Lieu', 'Joueur', 'Mode', 'Montant (EUR)', 'Payé par', 'Commentaire', 'Supprimée'],
  ]
  const sorted = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt))
  for (const game of sorted) {
    for (const entry of game.entries) {
      rows.push([
        game.playedAt,
        game.location,
        nameOf(entry.playerId),
        PAYMENT_LABELS[entry.paymentType],
        centsToInput(entry.amountCents),
        nameOf(entry.paidById),
        game.comment ?? '',
        game.deletedAt ? 'oui' : '',
      ])
    }
  }
  return toCsv(rows)
}

export function settlementsCsv(settlements: readonly Settlement[], nameOf: NameOf): string {
  const rows: (string | number | null)[][] = [
    ['Date', 'Type', 'De', 'À', 'Montant (EUR)', 'Dont tickets CSE', 'Commentaire', 'Supprimé'],
  ]
  const sorted = [...settlements].sort((a, b) => a.settledAt.localeCompare(b.settledAt))
  for (const s of sorted) {
    rows.push([
      s.settledAt,
      s.kind === 'OPENING' ? "Solde d'ouverture" : 'Remboursement',
      nameOf(s.fromId),
      nameOf(s.toId),
      centsToInput(s.amountCents),
      s.cseTickets ?? 0,
      s.comment ?? '',
      s.deletedAt ? 'oui' : '',
    ])
  }
  return toCsv(rows)
}
