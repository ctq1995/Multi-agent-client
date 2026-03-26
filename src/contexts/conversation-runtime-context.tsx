"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
import type { ConversationRuntimeAction } from "./conversation-runtime/action-types"
import { conversationRuntimeReducer } from "./conversation-runtime/reducer"
import {
  selectConversationIdByExternalId,
  selectConversationSession,
  selectTimelineTurns,
} from "./conversation-runtime/selectors"
import {
  ConversationRuntimeStoreContext,
  type ConversationRuntimeStoreApi,
  useConversationSession,
  useConversationTimelineTurns,
} from "./conversation-runtime/store-api"
import { createInitialConversationRuntimeState } from "./conversation-runtime/state"
import type { LiveMessage } from "@/contexts/acp-connections-context"
import type { MessageTurn } from "@/lib/types"
import type {
  ConversationRuntimeContextValue,
  ConversationSyncState,
} from "./conversation-runtime/types"

export type {
  ConversationRuntimeSession,
  ConversationSyncState,
  ConversationTimelinePhase,
  ConversationTimelineTurn,
} from "./conversation-runtime/types"
export { useConversationSession, useConversationTimelineTurns }
export { buildStreamingTurnFromLiveMessage }

interface InternalStore {
  state: ReturnType<typeof createInitialConversationRuntimeState>
  keyListeners: Map<number, Set<() => void>>
}

const ConversationRuntimeActionsContext =
  createContext<ConversationRuntimeContextValue | null>(null)

export function ConversationRuntimeProvider({
  children,
}: {
  children: ReactNode
}) {
  const storeRef = useRef<InternalStore>({
    state: createInitialConversationRuntimeState(),
    keyListeners: new Map(),
  })

  const notifyConversationListeners = useCallback((conversationId: number) => {
    const listeners = storeRef.current.keyListeners.get(conversationId)
    if (!listeners) {
      return
    }

    for (const listener of listeners) {
      listener()
    }
  }, [])

  const notifyAllConversationListeners = useCallback(() => {
    for (const listeners of storeRef.current.keyListeners.values()) {
      for (const listener of listeners) {
        listener()
      }
    }
  }, [])

  const dispatch = useCallback(
    (action: ConversationRuntimeAction) => {
      const prev = storeRef.current.state
      const next = conversationRuntimeReducer(prev, action)
      if (next === prev) {
        return
      }

      storeRef.current.state = next
      if (action.type === "RESET") {
        notifyAllConversationListeners()
        return
      }

      notifyConversationListeners(action.conversationId)
    },
    [notifyAllConversationListeners, notifyConversationListeners]
  )

  const readState = useCallback(() => storeRef.current.state, [])

  const storeApi = useMemo<ConversationRuntimeStoreApi>(
    () => ({
      getSession(conversationId: number) {
        return selectConversationSession(storeRef.current.state, conversationId)
      },
      getTimelineTurns(conversationId: number) {
        return selectTimelineTurns(storeRef.current.state, conversationId)
      },
      getConversationIdByExternalId(externalId: string) {
        return selectConversationIdByExternalId(
          storeRef.current.state,
          externalId
        )
      },
      subscribeKey(conversationId: number, cb: () => void) {
        const { keyListeners } = storeRef.current
        let listeners = keyListeners.get(conversationId)
        if (!listeners) {
          listeners = new Set()
          keyListeners.set(conversationId, listeners)
        }

        listeners.add(cb)
        return () => {
          listeners!.delete(cb)
          if (listeners!.size === 0) {
            keyListeners.delete(conversationId)
          }
        }
      },
    }),
    []
  )

  const fetchDetail = useCallback(
    (conversationId: number, runtimeConversationId?: number) => {
      const targetConversationId = runtimeConversationId ?? conversationId
      const session =
        storeRef.current.state.byConversationId.get(targetConversationId) ??
        null

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
    [dispatch]
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
    [dispatch]
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
    [dispatch, readState]
  )

  const completeTurn = useCallback(
    (conversationId: number) => {
      dispatch({ type: "COMPLETE_TURN", conversationId })
    },
    [dispatch]
  )

  const appendOptimisticTurn = useCallback(
    (conversationId: number, turn: MessageTurn, turnToken: string) => {
      dispatch({
        type: "APPEND_OPTIMISTIC_TURN",
        conversationId,
        turn,
        turnToken,
      })
    },
    [dispatch]
  )

  const setLiveMessage = useCallback(
    (conversationId: number, liveMessage: LiveMessage | null) => {
      dispatch({ type: "SET_LIVE_MESSAGE", conversationId, liveMessage })
    },
    [dispatch]
  )

  const setExternalId = useCallback(
    (conversationId: number, externalId: string | null) => {
      dispatch({ type: "SET_EXTERNAL_ID", conversationId, externalId })
    },
    [dispatch]
  )

  const setSyncState = useCallback(
    (conversationId: number, syncState: ConversationSyncState) => {
      dispatch({ type: "SET_SYNC_STATE", conversationId, syncState })
    },
    [dispatch]
  )

  const setPendingCleanup = useCallback(
    (conversationId: number, pendingCleanup: boolean) => {
      dispatch({ type: "SET_PENDING_CLEANUP", conversationId, pendingCleanup })
    },
    [dispatch]
  )

  const removeConversation = useCallback(
    (conversationId: number) => {
      dispatch({ type: "REMOVE_CONVERSATION", conversationId })
    },
    [dispatch]
  )

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [dispatch])

  const actions = useMemo<ConversationRuntimeContextValue>(
    () => ({
      getSession: storeApi.getSession,
      getConversationIdByExternalId: storeApi.getConversationIdByExternalId,
      getTimelineTurns: storeApi.getTimelineTurns,
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
      refetchDetail,
      removeConversation,
      reset,
      setExternalId,
      setLiveMessage,
      setPendingCleanup,
      setSyncState,
      storeApi,
      syncTurnMetadata,
    ]
  )

  return (
    <ConversationRuntimeStoreContext.Provider value={storeApi}>
      <ConversationRuntimeActionsContext.Provider value={actions}>
        {children}
      </ConversationRuntimeActionsContext.Provider>
    </ConversationRuntimeStoreContext.Provider>
  )
}

export function useConversationRuntime() {
  const ctx = useContext(ConversationRuntimeActionsContext)
  if (!ctx) {
    throw new Error(
      "useConversationRuntime must be used within ConversationRuntimeProvider"
    )
  }
  return ctx
}
