"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"
import { getFolderConversation } from "@/lib/tauri"
import {
  dispatchDetailLoad,
  scheduleMetadataSync,
  shouldSkipInitialFetch,
} from "./conversation-runtime/actions"
import { buildStreamingTurnFromLiveMessage } from "./conversation-runtime/live-message"
import { conversationRuntimeReducer } from "./conversation-runtime/reducer"
import {
  selectConversationIdByExternalId,
  selectConversationSession,
  selectTimelineTurns,
} from "./conversation-runtime/selectors"
import { createInitialConversationRuntimeState } from "./conversation-runtime/state"
import type { LiveMessage } from "@/contexts/acp-connections-context"
import type { MessageTurn } from "@/lib/types"
import type {
  ConversationRuntimeContextValue,
  ConversationRuntimeSession,
  ConversationSyncState,
  ConversationTimelineTurn,
} from "./conversation-runtime/types"

export type {
  ConversationRuntimeSession,
  ConversationSyncState,
  ConversationTimelinePhase,
  ConversationTimelineTurn,
} from "./conversation-runtime/types"
export { buildStreamingTurnFromLiveMessage }

const ConversationRuntimeContext =
  createContext<ConversationRuntimeContextValue | null>(null)

export function ConversationRuntimeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(
    conversationRuntimeReducer,
    undefined,
    createInitialConversationRuntimeState
  )

  const stateRef = useRef(state)
  // eslint-disable-next-line react-hooks/refs -- stateRef is only read in callbacks, not during render
  stateRef.current = state

  const readState = useCallback(() => stateRef.current, [])

  const getSession = useCallback(
    (conversationId: number): ConversationRuntimeSession | null =>
      selectConversationSession(state, conversationId),
    [state]
  )

  const getConversationIdByExternalId = useCallback(
    (externalId: string): number | null =>
      selectConversationIdByExternalId(state, externalId),
    [state]
  )

  const getTimelineTurns = useCallback(
    (conversationId: number): ConversationTimelineTurn[] =>
      selectTimelineTurns(state, conversationId),
    [state]
  )

  const fetchDetail = useCallback(
    (conversationId: number, runtimeConversationId?: number) => {
      const targetConversationId = runtimeConversationId ?? conversationId
      const session =
        stateRef.current.byConversationId.get(targetConversationId) ?? null

      if (shouldSkipInitialFetch(session)) {
        return
      }

      dispatchDetailLoad({
        deps: {
          dispatch,
          loadConversation: getFolderConversation,
        },
        request: { conversationId, runtimeConversationId },
      })
    },
    []
  )

  const refetchDetail = useCallback(
    (conversationId: number, runtimeConversationId?: number) => {
      dispatchDetailLoad({
        deps: {
          dispatch,
          loadConversation: getFolderConversation,
        },
        request: { conversationId, runtimeConversationId },
      })
    },
    []
  )

  const syncTurnMetadata = useCallback(
    (dbConversationId: number, runtimeConversationId?: number) =>
      scheduleMetadataSync({
        dispatch,
        readState,
        loadConversation: getFolderConversation,
        dbConversationId,
        runtimeConversationId: runtimeConversationId ?? dbConversationId,
      }),
    [readState]
  )

  const completeTurn = useCallback((conversationId: number) => {
    dispatch({ type: "COMPLETE_TURN", conversationId })
  }, [])

  const appendOptimisticTurn = useCallback(
    (conversationId: number, turn: MessageTurn, turnToken: string) => {
      dispatch({
        type: "APPEND_OPTIMISTIC_TURN",
        conversationId,
        turn,
        turnToken,
      })
    },
    []
  )

  const setLiveMessage = useCallback(
    (conversationId: number, liveMessage: LiveMessage | null) => {
      dispatch({ type: "SET_LIVE_MESSAGE", conversationId, liveMessage })
    },
    []
  )

  const setExternalId = useCallback(
    (conversationId: number, externalId: string | null) => {
      dispatch({ type: "SET_EXTERNAL_ID", conversationId, externalId })
    },
    []
  )

  const setSyncState = useCallback(
    (conversationId: number, syncState: ConversationSyncState) => {
      dispatch({ type: "SET_SYNC_STATE", conversationId, syncState })
    },
    []
  )

  const setPendingCleanup = useCallback(
    (conversationId: number, pendingCleanup: boolean) => {
      dispatch({ type: "SET_PENDING_CLEANUP", conversationId, pendingCleanup })
    },
    []
  )

  const removeConversation = useCallback((conversationId: number) => {
    dispatch({ type: "REMOVE_CONVERSATION", conversationId })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  const value = useMemo<ConversationRuntimeContextValue>(
    () => ({
      getSession,
      getConversationIdByExternalId,
      getTimelineTurns,
      fetchDetail,
      refetchDetail,
      syncTurnMetadata,
      completeTurn,
      appendOptimisticTurn,
      setLiveMessage,
      setExternalId,
      setSyncState,
      setPendingCleanup,
      removeConversation,
      reset,
    }),
    [
      appendOptimisticTurn,
      completeTurn,
      fetchDetail,
      getConversationIdByExternalId,
      getSession,
      getTimelineTurns,
      refetchDetail,
      removeConversation,
      reset,
      setExternalId,
      setLiveMessage,
      setPendingCleanup,
      setSyncState,
      syncTurnMetadata,
    ]
  )

  return (
    <ConversationRuntimeContext.Provider value={value}>
      {children}
    </ConversationRuntimeContext.Provider>
  )
}

export function useConversationRuntime() {
  const ctx = useContext(ConversationRuntimeContext)
  if (!ctx) {
    throw new Error(
      "useConversationRuntime must be used within ConversationRuntimeProvider"
    )
  }
  return ctx
}
