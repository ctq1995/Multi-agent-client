import type { ConversationRuntimeAction } from "./action-types"
import type {
  ConversationRuntimeSession,
  ConversationRuntimeState,
} from "./types"
import type { DbConversationDetail } from "@/lib/types"

const INITIAL_METADATA_SYNC_DELAY_MS = 1500
const RETRY_METADATA_SYNC_DELAY_MS = 3000
const MAX_METADATA_SYNC_ATTEMPTS = 2
const MAX_METADATA_FINALIZATION_ATTEMPTS = 1

export interface ConversationRuntimeIoDeps {
  dispatch: (action: ConversationRuntimeAction) => void
  loadConversation: (conversationId: number) => Promise<DbConversationDetail>
}

interface DetailRequest {
  conversationId: number
  runtimeConversationId?: number
}

interface MetadataSyncRequest extends ConversationRuntimeIoDeps {
  dbConversationId: number
  runtimeConversationId: number
  readState: () => ConversationRuntimeState
}

interface MetadataSyncAttempt extends MetadataSyncRequest {
  attempt: number
  minExpectedTurnCount?: number
  isCancelled: () => boolean
  scheduleAttempt: (attempt: number, minExpectedTurnCount?: number) => void
}

function resolveRuntimeConversationId(request: DetailRequest): number {
  return request.runtimeConversationId ?? request.conversationId
}

function getSessionForConversation(params: {
  readState: () => ConversationRuntimeState
  conversationId: number
}): ConversationRuntimeSession | null {
  return params.readState().byConversationId.get(params.conversationId) ?? null
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function shouldSkipInitialFetch(
  session: ConversationRuntimeSession | null
): boolean {
  if (!session) {
    return false
  }
  if (session.detail || session.detailLoading) {
    return true
  }

  return (
    session.optimisticTurns.length > 0 ||
    session.liveMessage !== null ||
    session.localTurns.length > 0
  )
}

function hasFinalAssistantMetadata(detail: DbConversationDetail): boolean {
  const assistantTurns = detail.turns.filter(
    (turn) => turn.role === "assistant"
  )
  const latestAssistant = assistantTurns[assistantTurns.length - 1]

  return Boolean(
    latestAssistant?.usage ??
    latestAssistant?.duration_ms ??
    latestAssistant?.model ??
    detail.session_stats
  )
}

function getExpectedTurnCount(params: {
  session: ConversationRuntimeSession
  minExpectedTurnCount?: number
}): number {
  if (params.minExpectedTurnCount != null) {
    return params.minExpectedTurnCount
  }

  return (
    (params.session.detail?.turns.length ?? 0) +
    params.session.localTurns.length
  )
}

export function dispatchDetailLoad(params: {
  deps: ConversationRuntimeIoDeps
  request: DetailRequest
}): void {
  const targetConversationId = resolveRuntimeConversationId(params.request)

  params.deps.dispatch({
    type: "FETCH_DETAIL_START",
    conversationId: targetConversationId,
  })

  void params.deps
    .loadConversation(params.request.conversationId)
    .then((detail) => {
      params.deps.dispatch({
        type: "FETCH_DETAIL_SUCCESS",
        conversationId: targetConversationId,
        detail,
      })
    })
    .catch((error: unknown) => {
      params.deps.dispatch({
        type: "FETCH_DETAIL_ERROR",
        conversationId: targetConversationId,
        error: normalizeErrorMessage(error),
      })
    })
}

function runMetadataSyncAttempt(params: MetadataSyncAttempt): void {
  if (params.isCancelled()) {
    return
  }

  const session = getSessionForConversation({
    readState: params.readState,
    conversationId: params.runtimeConversationId,
  })
  if (!session || session.syncState === "awaiting_persist") {
    return
  }

  const expectedTurnCount = getExpectedTurnCount({
    session,
    minExpectedTurnCount: params.minExpectedTurnCount,
  })
  if (expectedTurnCount === 0) {
    return
  }

  void params
    .loadConversation(params.dbConversationId)
    .then((detail) => {
      if (params.isCancelled()) {
        return
      }

      const current = getSessionForConversation({
        readState: params.readState,
        conversationId: params.runtimeConversationId,
      })
      if (!current || current.syncState === "awaiting_persist") {
        return
      }

      if (detail.turns.length < expectedTurnCount) {
        if (params.attempt < MAX_METADATA_SYNC_ATTEMPTS) {
          params.scheduleAttempt(params.attempt + 1, expectedTurnCount)
        }
        return
      }

      params.dispatch({
        type: "FETCH_DETAIL_SUCCESS",
        conversationId: params.runtimeConversationId,
        detail,
      })
      params.dispatch({
        type: "SYNC_SESSION_STATS",
        conversationId: params.runtimeConversationId,
        sessionStats: detail.session_stats ?? null,
      })

      if (
        !hasFinalAssistantMetadata(detail) &&
        params.attempt < MAX_METADATA_FINALIZATION_ATTEMPTS
      ) {
        params.scheduleAttempt(params.attempt + 1, expectedTurnCount)
      }
    })
    .catch(() => {
      if (params.attempt < MAX_METADATA_SYNC_ATTEMPTS) {
        params.scheduleAttempt(params.attempt + 1, expectedTurnCount)
      }
    })
}

export function scheduleMetadataSync(params: MetadataSyncRequest): () => void {
  let cancelled = false
  let timerId: ReturnType<typeof setTimeout> | null = null

  const scheduleAttempt = (attempt: number, minExpectedTurnCount?: number) => {
    const delay =
      attempt === 0
        ? INITIAL_METADATA_SYNC_DELAY_MS
        : RETRY_METADATA_SYNC_DELAY_MS

    timerId = setTimeout(() => {
      runMetadataSyncAttempt({
        ...params,
        attempt,
        minExpectedTurnCount,
        isCancelled: () => cancelled,
        scheduleAttempt,
      })
    }, delay)
  }

  scheduleAttempt(0)

  return () => {
    cancelled = true
    if (timerId) {
      clearTimeout(timerId)
    }
  }
}
