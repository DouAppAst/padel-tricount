import type { Game, GameEntry, PaymentType } from '../../domain/models'
import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

interface GameEntryRow {
  player_id: string
  paid_by_participant_id: string
  payment_type: PaymentType
  amount_cents: number
}

interface GameRow {
  id: string
  played_at: string
  location: string
  comment: string | null
  created_by: string | null
  updated_by: string | null
  updated_at: string
  deleted_at: string | null
  game_entries: GameEntryRow[]
}

const COLUMNS =
  'id, played_at, location, comment, created_by, updated_by, updated_at, deleted_at, ' +
  'game_entries (player_id, paid_by_participant_id, payment_type, amount_cents)'

const toGame = (row: GameRow): Game => ({
  id: row.id,
  playedAt: row.played_at,
  location: row.location,
  comment: row.comment,
  createdById: row.created_by,
  updatedById: row.updated_by,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  entries: row.game_entries.map((entry) => ({
    playerId: entry.player_id,
    paidById: entry.paid_by_participant_id,
    paymentType: entry.payment_type,
    amountCents: entry.amount_cents,
  })),
})

/** All games, including soft-deleted ones (balances ignore them), most recent first. */
export async function listGames(): Promise<Game[]> {
  const rows = unwrap(
    await supabase()
      .from('games')
      .select(COLUMNS)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<GameRow[]>(),
  )
  return rows.map(toGame)
}

export interface SaveGameInput {
  id?: string
  playedAt: string
  location: string
  comment?: string | null
  entries: GameEntry[]
}

/** Creates or fully replaces a game and its entries in a single transaction. */
export async function saveGame(input: SaveGameInput): Promise<string> {
  return unwrap(
    await supabase().rpc('save_game', {
      p_game_id: input.id ?? null,
      p_played_at: input.playedAt,
      p_location: input.location,
      p_comment: input.comment ?? null,
      p_entries: input.entries.map((entry) => ({
        player_id: entry.playerId,
        paid_by_participant_id: entry.paidById,
        payment_type: entry.paymentType,
        amount_cents: entry.amountCents,
      })),
    }),
  ) as string
}

export async function setGameDeleted(id: string, deleted: boolean): Promise<void> {
  ensureOk(await supabase().rpc('set_game_deleted', { p_game_id: id, p_deleted: deleted }))
}
