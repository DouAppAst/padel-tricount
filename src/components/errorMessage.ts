import { ApiError, type ApiErrorCode } from '../data/errors'

const MESSAGES: Record<ApiErrorCode, string> = {
  NOT_AUTHENTICATED: 'Email ou mot de passe incorrect.',
  NOT_MEMBER: 'Ton compte n’est pas encore validé par un admin.',
  NOT_ADMIN: 'Action réservée aux admins.',
  ALREADY_LINKED: 'Ton compte est déjà lié à un participant.',
  PARTICIPANT_UNAVAILABLE: 'Ce participant n’est plus disponible.',
  REQUEST_NOT_FOUND: 'Cette demande a déjà été traitée.',
  GAME_NOT_FOUND: 'Cette partie n’existe plus ou a été supprimée.',
  SETTLEMENT_NOT_FOUND: 'Ce remboursement n’existe plus ou a été supprimé.',
  NO_PLAYER: 'Sélectionne au moins un joueur.',
  LAST_ADMIN: 'Il doit rester au moins un admin.',
  DUPLICATE: 'Ce nom est déjà utilisé.',
  IN_USE: 'Ce participant apparaît dans l’historique : désactive-le plutôt.',
  INVALID: 'Certaines valeurs sont invalides.',
  UNKNOWN: 'Une erreur est survenue. Vérifie ta connexion et réessaie.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code]
  if (error instanceof TypeError) return 'Connexion impossible. Vérifie ton réseau et réessaie.'
  return MESSAGES.UNKNOWN
}
