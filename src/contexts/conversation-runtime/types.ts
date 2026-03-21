import type { LiveMessage } from "@/contexts/acp-connections-context"
import type {
  DbConversationDetail,
  MessageTurn,
  SessionStats,
} from "@/lib/types"

export type ConversationSyncState = "idle" | "awaiting_persist"

export type ConversationTimelinePhase = "persisted" | "optimistic" | "streaming"

export interface ConversationTimelineTurn {
  key: string
  turn: MessageTurn
  phase: ConversationTimelinePhase
}

export interface ConversationRuntimeSession {
  readonly conversationId: number
  readonly externalId: string | null
  readonly detail: DbConversationDetail | null
  readonly detailLoading: boolean
  readonly detailError: string | null
  readonly localTurns: MessageTurn[]
  readonly optimisticTurns: MessageTurn[]
  readonly liveMessage: LiveMessage | null
  readonly syncState: ConversationSyncState
  readonly sessionStats: SessionStats | null
  readonly pendingCleanup: boolean
}

export interface ConversationRuntimeState {
  readonly byConversationId: ReadonlyMap<number, ConversationRuntimeSession>
  readonly conversationIdByExternalId: ReadonlyMap<string, number>
}

export interface ConversationRuntimeContextValue {
  getSession: (conversationId: number) => ConversationRuntimeSession | null
  getConversationIdByExternalId: (externalId: string) => number | null
  getTimelineTurns: (conversationId: number) => ConversationTimelineTurn[]
  fetchDetail: (conversationId: number, runtimeConversationId?: number) => void
  refetchDetail: (
    conversationId: number,
    runtimeConversationId?: number
  ) => void
  completeTurn: (conversationId: number) => void
  appendOptimisticTurn: (
    conversationId: number,
    turn: MessageTurn,
    turnToken: string
  ) => void
  setLiveMessage: (
    conversationId: number,
    liveMessage: LiveMessage | null
  ) => void
  setExternalId: (conversationId: number, externalId: string | null) => void
  setSyncState: (
    conversationId: number,
    syncState: ConversationSyncState
  ) => void
  syncTurnMetadata: (
    dbConversationId: number,
    runtimeConversationId?: number
  ) => () => void
  setPendingCleanup: (conversationId: number, pendingCleanup: boolean) => void
  removeConversation: (conversationId: number) => void
  reset: () => void
}
