import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react"
import type {
  ConversationRuntimeSession,
  ConversationTimelineTurn,
} from "./types"

export interface ConversationRuntimeStoreApi {
  getSession: (conversationId: number) => ConversationRuntimeSession | null
  getTimelineTurns: (conversationId: number) => ConversationTimelineTurn[]
  getConversationIdByExternalId: (externalId: string) => number | null
  subscribeKey: (conversationId: number, cb: () => void) => () => void
}

export const ConversationRuntimeStoreContext =
  createContext<ConversationRuntimeStoreApi | null>(null)

function useConversationRuntimeStore() {
  const store = useContext(ConversationRuntimeStoreContext)
  if (!store) {
    throw new Error(
      "useConversationRuntimeStore must be used within ConversationRuntimeProvider"
    )
  }
  return store
}

export function useConversationSession(
  conversationId: number
): ConversationRuntimeSession | null {
  const store = useConversationRuntimeStore()
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeKey(conversationId, cb),
    [conversationId, store]
  )
  const getSnapshot = useCallback(
    () => store.getSession(conversationId),
    [conversationId, store]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useConversationTimelineTurns(
  conversationId: number
): ConversationTimelineTurn[] {
  const store = useConversationRuntimeStore()
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeKey(conversationId, cb),
    [conversationId, store]
  )
  const getSnapshot = useCallback(
    () => store.getTimelineTurns(conversationId),
    [conversationId, store]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
