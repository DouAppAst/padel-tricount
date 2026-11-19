import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useMemo } from 'react'
import { computeBalances, netBalances, type ParticipantBalance } from '../domain/balances'
import { cseTicketValue } from '../domain/cseTickets'
import { simplifyDebts } from '../domain/debtSimplification'
import type { ParticipantId, Transfer } from '../domain/models'
import * as account from './repositories/account'
import * as games from './repositories/games'
import * as participants from './repositories/participants'
import * as settings from './repositories/settings'
import * as settlements from './repositories/settlements'
import * as venues from './repositories/venues'

export const queryKeys = {
  myStatus: ['myStatus'],
  linkable: ['linkableParticipants'],
  linkRequests: ['linkRequests'],
  participants: ['participants'],
  settings: ['settings'],
  venues: ['venues'],
  games: ['games'],
  settlements: ['settlements'],
} as const satisfies Record<string, QueryKey>

export const useMyStatus = () =>
  useQuery({ queryKey: queryKeys.myStatus, queryFn: account.getMyStatus })
export const useLinkableParticipants = () =>
  useQuery({ queryKey: queryKeys.linkable, queryFn: account.listLinkableParticipants })
export const usePendingLinkRequests = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.linkRequests, queryFn: account.listPendingLinkRequests, enabled })
export const useParticipants = () =>
  useQuery({ queryKey: queryKeys.participants, queryFn: participants.listParticipants })
export const useSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: settings.getSettings })
export const useVenues = () => useQuery({ queryKey: queryKeys.venues, queryFn: venues.listVenues })
export const useGames = () => useQuery({ queryKey: queryKeys.games, queryFn: games.listGames })
export const useSettlements = () =>
  useQuery({ queryKey: queryKeys.settlements, queryFn: settlements.listSettlements })

/** Mutation that refreshes the given queries once it succeeds. */
function useInvalidatingMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  keys: QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useRequestLink = () =>
  useInvalidatingMutation(account.requestLink, [queryKeys.myStatus, queryKeys.linkable])
export const useApproveLink = () =>
  useInvalidatingMutation(account.approveLink, [queryKeys.linkRequests, queryKeys.participants])
export const useRejectLink = () =>
  useInvalidatingMutation(account.rejectLink, [queryKeys.linkRequests])

export const useCreateParticipant = () =>
  useInvalidatingMutation(participants.createParticipant, [queryKeys.participants])
export const useUpdateParticipant = () =>
  useInvalidatingMutation(
    ({ id, patch }: { id: ParticipantId; patch: participants.ParticipantPatch }) =>
      participants.updateParticipant(id, patch),
    [queryKeys.participants, queryKeys.myStatus],
  )
export const useDeleteParticipant = () =>
  useInvalidatingMutation(participants.deleteParticipant, [queryKeys.participants])

export const useSetDefaultVenue = () =>
  useInvalidatingMutation(settings.setDefaultVenue, [queryKeys.settings])
export const useCreateVenue = () => useInvalidatingMutation(venues.createVenue, [queryKeys.venues])
export const useUpdateVenue = () =>
  useInvalidatingMutation(
    ({ id, input }: { id: string; input: venues.VenueInput }) => venues.updateVenue(id, input),
    [queryKeys.venues],
  )
export const useSetVenueActive = () =>
  useInvalidatingMutation(
    ({ id, active }: { id: string; active: boolean }) => venues.setVenueActive(id, active),
    [queryKeys.venues],
  )

export const useSaveGame = () => useInvalidatingMutation(games.saveGame, [queryKeys.games])
export const useSetGameDeleted = () =>
  useInvalidatingMutation(
    ({ id, deleted }: { id: string; deleted: boolean }) => games.setGameDeleted(id, deleted),
    [queryKeys.games],
  )

export const useSaveRefund = () =>
  useInvalidatingMutation(settlements.saveRefund, [queryKeys.settlements])
export const useSaveOpeningDebt = () =>
  useInvalidatingMutation(
    ({ debt, settledAt, comment }: { debt: Transfer; settledAt: string; comment: string }) =>
      settlements.saveOpeningDebt(debt, { settledAt, comment }),
    [queryKeys.settlements],
  )
export const useSetSettlementDeleted = () =>
  useInvalidatingMutation(
    ({ id, deleted }: { id: string; deleted: boolean }) =>
      settlements.setSettlementDeleted(id, deleted),
    [queryKeys.settlements],
  )

/** Value of one CSE ticket used to suggest refunds in tickets (null if no club accepts them). */
export function useCseTicketValue(): number | null {
  const venuesQuery = useVenues()
  const settingsQuery = useSettings()
  if (!venuesQuery.data || !settingsQuery.data) return null
  return cseTicketValue(venuesQuery.data, settingsQuery.data.defaultVenueId)
}

export interface BalancesView {
  balances: Map<ParticipantId, ParticipantBalance>
  transfers: Transfer[]
}

/** Balances and suggested transfers, recomputed from games and settlements (never stored). */
export function useBalances() {
  const gamesQuery = useGames()
  const settlementsQuery = useSettlements()
  const participantsQuery = useParticipants()

  const data = useMemo<BalancesView | undefined>(() => {
    if (!gamesQuery.data || !settlementsQuery.data || !participantsQuery.data) return undefined
    const names = new Map(participantsQuery.data.map((p) => [p.id, p.displayName]))
    const balances = computeBalances(gamesQuery.data, settlementsQuery.data)
    const byName = (a: ParticipantId, b: ParticipantId) =>
      (names.get(a) ?? a).localeCompare(names.get(b) ?? b, 'fr')
    return { balances, transfers: simplifyDebts(netBalances(balances), byName) }
  }, [gamesQuery.data, settlementsQuery.data, participantsQuery.data])

  return {
    data,
    isPending: gamesQuery.isPending || settlementsQuery.isPending || participantsQuery.isPending,
    error: gamesQuery.error ?? settlementsQuery.error ?? participantsQuery.error,
  }
}
