import type {
  ConversationRuntimeSession,
  ConversationRuntimeState,
} from "./types"

export function createInitialConversationRuntimeState(): ConversationRuntimeState {
  return {
    byConversationId: new Map(),
    conversationIdByExternalId: new Map(),
  }
}

export function createEmptySession(
  conversationId: number
): ConversationRuntimeSession {
  return {
    conversationId,
    externalId: null,
    detail: null,
    detailLoading: false,
    detailError: null,
    localTurns: [],
    optimisticTurns: [],
    liveMessage: null,
    syncState: "idle",
    sessionStats: null,
    pendingCleanup: false,
  }
}

export function upsertExternalIdIndex(params: {
  index: ReadonlyMap<string, number>
  previousExternalId: string | null
  nextExternalId: string | null
  conversationId: number
}): Map<string, number> {
  const next = new Map(params.index)

  if (params.previousExternalId) {
    next.delete(params.previousExternalId)
  }
  if (params.nextExternalId) {
    next.set(params.nextExternalId, params.conversationId)
  }

  return next
}

export function updateSessionInState(params: {
  state: ConversationRuntimeState
  conversationId: number
  updater: (current: ConversationRuntimeSession) => ConversationRuntimeSession
}): ConversationRuntimeState {
  const current =
    params.state.byConversationId.get(params.conversationId) ??
    createEmptySession(params.conversationId)
  const nextSession = params.updater(current)
  const nextByConversationId = new Map(params.state.byConversationId)

  nextByConversationId.set(params.conversationId, nextSession)
  return {
    ...params.state,
    byConversationId: nextByConversationId,
  }
}
