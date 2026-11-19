import type { Session } from '@supabase/supabase-js'
import type { ParticipantId } from '../../domain/models'
import { ApiError, ensureOk, unwrap } from '../errors'
import { supabase } from '../supabaseClient'

export type LinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface MyStatus {
  participant: { id: ParticipantId; displayName: string; active: boolean; isAdmin: boolean } | null
  lastRequest: {
    id: string
    participantId: ParticipantId
    displayName: string
    status: LinkRequestStatus
  } | null
}

interface MyStatusRow {
  participant: { id: string; display_name: string; active: boolean; is_admin: boolean } | null
  last_request: {
    id: string
    participant_id: string
    display_name: string
    status: LinkRequestStatus
  } | null
}

// --- Authentication (email + password, no email is ever sent) ---

export async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await supabase().auth.signUp({ email: email.trim(), password })
  if (error) throw new ApiError('UNKNOWN', error.message)
  if (!data.session) {
    // Happens when "Confirm email" is enabled in Supabase: it must stay disabled.
    throw new ApiError('UNKNOWN', 'Account created without session: email confirmation is enabled')
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new ApiError('NOT_AUTHENTICATED', error.message)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut()
  if (error) throw new ApiError('UNKNOWN', error.message)
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession()
  return data.session
}

export function onSessionChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// --- Account <-> participant link ---

export async function getMyStatus(): Promise<MyStatus> {
  const row = unwrap(await supabase().rpc('get_my_status')) as MyStatusRow
  return {
    participant: row.participant && {
      id: row.participant.id,
      displayName: row.participant.display_name,
      active: row.participant.active,
      isAdmin: row.participant.is_admin,
    },
    lastRequest: row.last_request && {
      id: row.last_request.id,
      participantId: row.last_request.participant_id,
      displayName: row.last_request.display_name,
      status: row.last_request.status,
    },
  }
}

export async function listLinkableParticipants(): Promise<{ id: string; displayName: string }[]> {
  const rows = unwrap(await supabase().rpc('linkable_participants')) as {
    id: string
    display_name: string
  }[]
  return rows.map((row) => ({ id: row.id, displayName: row.display_name }))
}

export async function requestLink(participantId: ParticipantId): Promise<void> {
  ensureOk(await supabase().rpc('request_link', { p_participant_id: participantId }))
}

export interface PendingLinkRequest {
  id: string
  participantId: ParticipantId
  createdAt: string
}

/** Admin only (RLS returns only the caller's own requests otherwise). */
export async function listPendingLinkRequests(): Promise<PendingLinkRequest[]> {
  const rows = unwrap(
    await supabase()
      .from('link_requests')
      .select('id, participant_id, created_at')
      .eq('status', 'PENDING')
      .order('created_at')
      .returns<{ id: string; participant_id: string; created_at: string }[]>(),
  )
  return rows.map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    createdAt: row.created_at,
  }))
}

export async function approveLink(requestId: string): Promise<void> {
  ensureOk(await supabase().rpc('approve_link', { p_request_id: requestId }))
}

export async function rejectLink(requestId: string): Promise<void> {
  ensureOk(await supabase().rpc('reject_link', { p_request_id: requestId }))
}
