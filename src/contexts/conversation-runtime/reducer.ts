import { buildStreamingTurnFromLiveMessage } from "./live-message"
import type { ConversationRuntimeAction } from "./action-types"
import {
  createEmptySession,
  createInitialConversationRuntimeState,
  updateSessionInState,
  upsertExternalIdIndex,
} from "./state"
import type {
  ConversationRuntimeSession,
  ConversationRuntimeState,
} from "./types"

function handleFetchDetailSuccess(params: {
  state: ConversationRuntimeState
  action: Extract<ConversationRuntimeAction, { type: "FETCH_DETAIL_SUCCESS" }>
}): ConversationRuntimeState {
  const { action, state } = params
  const current =
    state.byConversationId.get(action.conversationId) ??
    createEmptySession(action.conversationId)
  const nextExternalId = action.detail.summary.external_id ?? null
  const isActivelyInteracting = current.syncState === "awaiting_persist"
  const nextSession: ConversationRuntimeSession = {
    ...current,
    detail: action.detail,
    detailLoading: false,
    detailError: null,
    externalId: nextExternalId ?? current.externalId,
    localTurns: [],
    sessionStats: action.detail.session_stats ?? current.sessionStats,
    ...(isActivelyInteracting
      ? {}
      : { optimisticTurns: [], liveMessage: null }),
  }

  const nextByConversationId = new Map(state.byConversationId)
  nextByConversationId.set(action.conversationId, nextSession)

  return {
    byConversationId: nextByConversationId,
    conversationIdByExternalId: upsertExternalIdIndex({
      index: state.conversationIdByExternalId,
      previousExternalId: current.externalId,
      nextExternalId: nextExternalId ?? current.externalId,
      conversationId: action.conversationId,
    }),
  }
}

function handleCompleteTurn(params: {
  state: ConversationRuntimeState
  conversationId: number
}): ConversationRuntimeState {
  const current = params.state.byConversationId.get(params.conversationId)
  if (!current) {
    return params.state
  }

  const promoted = [...current.localTurns, ...current.optimisticTurns]
  const streamingTurn = current.liveMessage
    ? buildStreamingTurnFromLiveMessage(
        current.conversationId,
        current.liveMessage
      )
    : null

  if (streamingTurn) {
    promoted.push(streamingTurn)
  }

  return updateSessionInState({
    state: params.state,
    conversationId: params.conversationId,
    updater: () => ({
      ...current,
      localTurns: promoted,
      optimisticTurns: [],
      liveMessage: null,
      syncState: "idle",
    }),
  })
}

function shouldIgnoreIncomingLiveMessage(params: {
  session: ConversationRuntimeSession
  liveMessage: ConversationRuntimeSession["liveMessage"]
}): boolean {
  if (
    params.liveMessage === null ||
    params.session.liveMessage !== null ||
    params.session.syncState === "awaiting_persist"
  ) {
    return false
  }

  const hasExistingTurns =
    (params.session.detail?.turns.length ?? 0) > 0 ||
    params.session.localTurns.length > 0

  return hasExistingTurns || params.session.detailLoading
}

function handleSetLiveMessage(params: {
  state: ConversationRuntimeState
  action: Extract<ConversationRuntimeAction, { type: "SET_LIVE_MESSAGE" }>
}): ConversationRuntimeState {
  const current = params.state.byConversationId.get(
    params.action.conversationId
  )
  if (!current && params.action.liveMessage === null) {
    return params.state
  }

  const session = current ?? createEmptySession(params.action.conversationId)
  if (
    shouldIgnoreIncomingLiveMessage({
      session,
      liveMessage: params.action.liveMessage,
    })
  ) {
    return params.state
  }

  return updateSessionInState({
    state: params.state,
    conversationId: params.action.conversationId,
    updater: () => ({
      ...session,
      liveMessage: params.action.liveMessage,
    }),
  })
}

function handleSetExternalId(params: {
  state: ConversationRuntimeState
  conversationId: number
  externalId: string | null
}): ConversationRuntimeState {
  const current =
    params.state.byConversationId.get(params.conversationId) ??
    createEmptySession(params.conversationId)
  const nextSession: ConversationRuntimeSession = {
    ...current,
    externalId: params.externalId,
  }
  const nextByConversationId = new Map(params.state.byConversationId)

  nextByConversationId.set(params.conversationId, nextSession)

  return {
    byConversationId: nextByConversationId,
    conversationIdByExternalId: upsertExternalIdIndex({
      index: params.state.conversationIdByExternalId,
      previousExternalId: current.externalId,
      nextExternalId: params.externalId,
      conversationId: params.conversationId,
    }),
  }
}

function handleRemoveConversation(params: {
  state: ConversationRuntimeState
  conversationId: number
}): ConversationRuntimeState {
  const current = params.state.byConversationId.get(params.conversationId)
  if (!current) {
    return params.state
  }

  const nextByConversationId = new Map(params.state.byConversationId)
  nextByConversationId.delete(params.conversationId)

  const nextExternalIndex = new Map(params.state.conversationIdByExternalId)
  if (current.externalId) {
    nextExternalIndex.delete(current.externalId)
  }

  return {
    byConversationId: nextByConversationId,
    conversationIdByExternalId: nextExternalIndex,
  }
}

export function conversationRuntimeReducer(
  state: ConversationRuntimeState,
  action: ConversationRuntimeAction
): ConversationRuntimeState {
  switch (action.type) {
    case "FETCH_DETAIL_START":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          detailLoading: true,
          detailError: null,
        }),
      })

    case "FETCH_DETAIL_SUCCESS":
      return handleFetchDetailSuccess({ state, action })

    case "FETCH_DETAIL_ERROR":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          detailLoading: false,
          detailError: action.error,
        }),
      })

    case "COMPLETE_TURN":
      return handleCompleteTurn({
        state,
        conversationId: action.conversationId,
      })

    case "APPEND_OPTIMISTIC_TURN":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          optimisticTurns: [...current.optimisticTurns, action.turn],
          syncState: "awaiting_persist",
        }),
      })

    case "SET_LIVE_MESSAGE":
      return handleSetLiveMessage({ state, action })

    case "SET_EXTERNAL_ID":
      return handleSetExternalId({
        state,
        conversationId: action.conversationId,
        externalId: action.externalId,
      })

    case "SET_SYNC_STATE":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          syncState: action.syncState,
        }),
      })

    case "SET_PENDING_CLEANUP":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          pendingCleanup: action.pendingCleanup,
        }),
      })

    case "SYNC_SESSION_STATS":
      return updateSessionInState({
        state,
        conversationId: action.conversationId,
        updater: (current) => ({
          ...current,
          detail:
            current.detail && action.sessionStats
              ? {
                  ...current.detail,
                  session_stats: action.sessionStats,
                }
              : current.detail,
          sessionStats: action.sessionStats ?? current.sessionStats,
        }),
      })

    case "REMOVE_CONVERSATION":
      return handleRemoveConversation({
        state,
        conversationId: action.conversationId,
      })

    case "RESET":
      return createInitialConversationRuntimeState()
  }
}
