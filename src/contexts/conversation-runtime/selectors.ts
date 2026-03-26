import { buildStreamingTurnFromLiveMessage } from "./live-message"
import type {
  ConversationRuntimeSession,
  ConversationRuntimeState,
  ConversationTimelinePhase,
  ConversationTimelineTurn,
} from "./types"
import type { MessageTurn } from "@/lib/types"

const EMPTY_TIMELINE_TURNS: ConversationTimelineTurn[] = []
const timelineTurnsCache = new WeakMap<
  ConversationRuntimeSession,
  ConversationTimelineTurn[]
>()

export function selectConversationSession(
  state: ConversationRuntimeState,
  conversationId: number
): ConversationRuntimeSession | null {
  return state.byConversationId.get(conversationId) ?? null
}

export function selectConversationIdByExternalId(
  state: ConversationRuntimeState,
  externalId: string
): number | null {
  return state.conversationIdByExternalId.get(externalId) ?? null
}

function mapTimelineTurns(params: {
  conversationId: number
  prefix: string
  phase: ConversationTimelinePhase
  turns: MessageTurn[]
}): ConversationTimelineTurn[] {
  const { conversationId, phase, prefix, turns } = params

  return turns.map((turn, index) => ({
    key: `${prefix}-${conversationId}-${turn.id}-${index}`,
    turn,
    phase,
  }))
}

export function selectTimelineTurns(
  state: ConversationRuntimeState,
  conversationId: number
): ConversationTimelineTurn[] {
  const session = state.byConversationId.get(conversationId)
  if (!session) {
    return EMPTY_TIMELINE_TURNS
  }

  const cached = timelineTurnsCache.get(session)
  if (cached) {
    return cached
  }

  const persisted = mapTimelineTurns({
    conversationId,
    prefix: "persisted",
    phase: "persisted",
    turns: session.detail?.turns ?? [],
  })
  const local = mapTimelineTurns({
    conversationId,
    prefix: "local",
    phase: "persisted",
    turns: session.localTurns,
  })
  const optimistic = mapTimelineTurns({
    conversationId,
    prefix: "optimistic",
    phase: "optimistic",
    turns: session.optimisticTurns,
  })
  const timeline = [...persisted, ...local, ...optimistic]

  if (!session.liveMessage) {
    timelineTurnsCache.set(session, timeline)
    return timeline
  }

  const streamingTurn = buildStreamingTurnFromLiveMessage(
    conversationId,
    session.liveMessage
  )
  if (!streamingTurn) {
    timelineTurnsCache.set(session, timeline)
    return timeline
  }

  const nextTimeline: ConversationTimelineTurn[] = [
    ...timeline,
    {
      key: `streaming-${conversationId}-${session.liveMessage.id}`,
      turn: streamingTurn,
      phase: "streaming",
    },
  ]
  timelineTurnsCache.set(session, nextTimeline)
  return nextTimeline
}
