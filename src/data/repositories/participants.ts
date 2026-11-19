import type { Participant, ParticipantId } from '../../domain/models'
import { ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

interface ParticipantRow {
  id: string
  display_name: string
  active: boolean
  is_admin: boolean
  auth_user_id: string | null
}

export interface ParticipantWithAccount extends Participant {
  hasAccount: boolean
}

const COLUMNS = 'id, display_name, active, is_admin, auth_user_id'

const toParticipant = (row: ParticipantRow): ParticipantWithAccount => ({
  id: row.id,
  displayName: row.display_name,
  active: row.active,
  isAdmin: row.is_admin,
  hasAccount: row.auth_user_id !== null,
})

export async function listParticipants(): Promise<ParticipantWithAccount[]> {
  const rows = unwrap(
    await supabase()
      .from('participants')
      .select(COLUMNS)
      .order('display_name')
      .returns<ParticipantRow[]>(),
  )
  return rows.map(toParticipant)
}

export async function createParticipant(displayName: string): Promise<void> {
  ensureOk(await supabase().from('participants').insert({ display_name: displayName.trim() }))
}

export interface ParticipantPatch {
  displayName?: string
  active?: boolean
  isAdmin?: boolean
  unlinkAccount?: boolean
}

export async function updateParticipant(id: ParticipantId, patch: ParticipantPatch): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim()
  if (patch.active !== undefined) row.active = patch.active
  if (patch.isAdmin !== undefined) row.is_admin = patch.isAdmin
  if (patch.unlinkAccount) row.auth_user_id = null
  ensureOk(await supabase().from('participants').update(row).eq('id', id))
}

/** Only possible for participants that never appear in a game or settlement. */
export async function deleteParticipant(id: ParticipantId): Promise<void> {
  ensureOk(await supabase().from('participants').delete().eq('id', id))
}
