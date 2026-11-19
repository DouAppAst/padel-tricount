import { openingSettlementFields } from '../../domain/balances'
import type { Settlement, SettlementKind, Transfer } from '../../domain/models'
import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

interface SettlementRow {
  id: string
  from_participant_id: string
  to_participant_id: string
  amount_cents: number
  kind: SettlementKind
  settled_at: string
  comment: string | null
  created_by: string | null
  updated_at: string
  deleted_at: string | null
}

const COLUMNS =
  'id, from_participant_id, to_participant_id, amount_cents, kind, settled_at, comment, ' +
  'created_by, updated_at, deleted_at'

const toSettlement = (row: SettlementRow): Settlement => ({
  id: row.id,
  fromId: row.from_participant_id,
  toId: row.to_participant_id,
  amountCents: row.amount_cents,
  kind: row.kind,
  settledAt: row.settled_at,
  comment: row.comment,
  createdById: row.created_by,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

/** All settlements, including soft-deleted ones (balances ignore them), most recent first. */
export async function listSettlements(): Promise<Settlement[]> {
  const rows = unwrap(
    await supabase()
      .from('settlements')
      .select(COLUMNS)
      .order('settled_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<SettlementRow[]>(),
  )
  return rows.map(toSettlement)
}

export interface SaveRefundInput {
  id?: string
  fromId: string
  toId: string
  amountCents: number
  settledAt?: string
  comment?: string | null
}

async function save(input: SaveRefundInput, kind: SettlementKind): Promise<string> {
  return unwrap(
    await supabase().rpc('save_settlement', {
      p_settlement_id: input.id ?? null,
      p_from_participant_id: input.fromId,
      p_to_participant_id: input.toId,
      p_amount_cents: input.amountCents,
      p_settled_at: input.settledAt ?? null,
      p_comment: input.comment ?? null,
      p_kind: kind,
    }),
  ) as string
}

/** Money actually handed over by `fromId` to `toId`. */
export function saveRefund(input: SaveRefundInput): Promise<string> {
  return save(input, 'REFUND')
}

/** Admin only: imports "debt.fromId owes debt.amountCents to debt.toId" from the spreadsheet. */
export function saveOpeningDebt(
  debt: Transfer,
  extra: Pick<SaveRefundInput, 'id' | 'settledAt' | 'comment'> = {},
): Promise<string> {
  const { fromId, toId, amountCents } = openingSettlementFields(debt)
  return save({ ...extra, fromId, toId, amountCents }, 'OPENING')
}

export async function setSettlementDeleted(id: string, deleted: boolean): Promise<void> {
  ensureOk(
    await supabase().rpc('set_settlement_deleted', { p_settlement_id: id, p_deleted: deleted }),
  )
}
