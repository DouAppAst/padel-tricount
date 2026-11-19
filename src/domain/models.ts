/** Integer amount in euro cents. Never use floating-point euros for computations. */
export type Cents = number

export type ParticipantId = string

export const PAYMENT_TYPES = ['CSE_TICKET', 'REGULAR', 'FREE', 'CUSTOM'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export interface Participant {
  id: ParticipantId
  displayName: string
  active: boolean
  isAdmin: boolean
}

export interface Prices {
  cseTicketCents: Cents
  regularCents: Cents
}

export interface GameEntry {
  playerId: ParticipantId
  paidById: ParticipantId
  paymentType: PaymentType
  amountCents: Cents
}

export interface Game {
  id: string
  playedAt: string
  location: string
  comment?: string | null
  entries: GameEntry[]
  deletedAt?: string | null
}

export type SettlementKind = 'REFUND' | 'OPENING'

/** Money handed over by `fromId` to `toId`. */
export interface Settlement {
  id: string
  fromId: ParticipantId
  toId: ParticipantId
  amountCents: Cents
  kind: SettlementKind
  settledAt: string
  comment?: string | null
  deletedAt?: string | null
}

/** Suggested transfer: `fromId` should pay `amountCents` to `toId`. */
export interface Transfer {
  fromId: ParticipantId
  toId: ParticipantId
  amountCents: Cents
}
