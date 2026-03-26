"use client"

import { useCallback, useDeferredValue, useEffect, useMemo } from "react"
import {
  useConversationSession,
  useConversationTimelineTurns,
} from "@/contexts/conversation-runtime-context"
import { MessageThreadScrollButton } from "@/components/ai-elements/message-thread"
import {
  adaptMessageTurn,
  type AdaptedMessage,
} from "@/lib/adapters/ai-elements-adapter"
import { LiveTurnStats } from "./live-turn-stats"
import { useSessionStats } from "@/contexts/session-stats-context"
import { AgentPlanOverlay } from "@/components/chat/agent-plan-overlay"
import { MessageThread } from "@/components/ai-elements/message-thread"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  buildPlanKey,
  extractLatestPlanEntriesFromMessages,
} from "@/lib/agent-plan"
import type { AgentType, ConnectionStatus, SessionStats } from "@/lib/types"
import { CodeBlockVisibilityProvider } from "@/components/ai-elements/code-block"
import { VirtualizedMessageThread } from "@/components/message/virtualized-message-thread"
import { useChatDisplaySettings } from "@/hooks/use-chat-display-settings"
import {
  AutoScrollOnSend,
  getCachedThreadTurnItem,
  HistoricalMessageGroup,
  PendingTypingIndicator,
  TYPING_THREAD_ITEM,
  type ThreadRenderItem,
} from "./message-thread-items"

interface MessageListViewProps {
  conversationId: number
  agentType: AgentType
  connStatus?: ConnectionStatus | null
  isActive?: boolean
  isVisible?: boolean
  sendSignal?: number
  sessionStats?: SessionStats | null
  detailLoading?: boolean
  detailError?: string | null
  hideEmptyState?: boolean
}

export function MessageListView({
  conversationId,
  agentType,
  connStatus,
  isActive = true,
  isVisible = true,
  sendSignal = 0,
  sessionStats = null,
  detailLoading = false,
  detailError = null,
  hideEmptyState = false,
}: MessageListViewProps) {
  const t = useTranslations("Folder.chat.messageList")
  const sharedT = useTranslations("Folder.chat.shared")
  const tThread = useTranslations("Folder.chat.messageThread")
  const { settings: chatDisplaySettings } = useChatDisplaySettings()
  const session = useConversationSession(conversationId)
  const timelineTurns = useConversationTimelineTurns(conversationId)
  const deferredTimelineTurns = useDeferredValue(timelineTurns)
  const renderTimelineTurns = isVisible ? timelineTurns : deferredTimelineTurns
  const liveMessage = session?.liveMessage ?? null

  const { setSessionStats } = useSessionStats()

  useEffect(() => {
    if (isActive) {
      setSessionStats(sessionStats)
    }
  }, [isActive, sessionStats, setSessionStats])

  const shouldUseSmoothResize = !(
    isVisible &&
    !detailLoading &&
    renderTimelineTurns.length
  )
  const virtualizedOverscan = isVisible ? 10 : 4

  const adapterText = useMemo(
    () => ({
      attachedResources: sharedT("attachedResources"),
      toolCallFailed: sharedT("toolCallFailed"),
    }),
    [sharedT]
  )

  const sessionSyncState = session?.syncState ?? "idle"

  const { threadItems, nonStreamingAdapted } = useMemo(() => {
    const items: ThreadRenderItem[] = []
    const nonStreaming: AdaptedMessage[] = []

    for (let index = 0; index < renderTimelineTurns.length; index += 1) {
      const timelineTurn = renderTimelineTurns[index]
      const adapted = adaptMessageTurn(
        timelineTurn.turn,
        adapterText,
        timelineTurn.phase === "streaming"
      )
      items.push(
        getCachedThreadTurnItem({
          adapted,
          phase: timelineTurn.phase,
        })
      )
      if (timelineTurn.phase !== "streaming") {
        nonStreaming.push(adapted)
      }
    }

    const lastPhase =
      renderTimelineTurns[renderTimelineTurns.length - 1]?.phase ?? null
    if (
      lastPhase === "optimistic" &&
      (connStatus === "prompting" || sessionSyncState === "awaiting_persist")
    ) {
      items.push(TYPING_THREAD_ITEM)
    }

    return { threadItems: items, nonStreamingAdapted: nonStreaming }
  }, [adapterText, connStatus, renderTimelineTurns, sessionSyncState])

  const historicalPlanEntries = useMemo(
    () => extractLatestPlanEntriesFromMessages(nonStreamingAdapted),
    [nonStreamingAdapted]
  )
  const historicalPlanKey = useMemo(
    () => buildPlanKey(historicalPlanEntries),
    [historicalPlanEntries]
  )

  const renderThreadItem = useCallback(
    (item: ThreadRenderItem) => {
      switch (item.kind) {
        case "turn":
          return (
            <HistoricalMessageGroup
              group={item.group}
              dimmed={item.phase === "optimistic"}
              autoCollapseLongUserMessages={
                chatDisplaySettings.autoCollapseLongUserMessages
              }
            />
          )
        case "typing":
          return <PendingTypingIndicator />
        default:
          return null
      }
    },
    [chatDisplaySettings.autoCollapseLongUserMessages]
  )

  const emptyState = useMemo(
    () =>
      hideEmptyState ? null : (
        <div className="px-4 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {t("emptyConversation")}
          </p>
        </div>
      ),
    [hideEmptyState, t]
  )

  const agentPlanOverlayKey = liveMessage?.id ?? `history-${conversationId}`

  const hasRenderableContent = threadItems.length > 0 || Boolean(liveMessage)

  if (detailLoading && !hasRenderableContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("loading")}</span>
        </div>
      </div>
    )
  }

  if (detailError && !hasRenderableContent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            {t("error", { message: detailError })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <CodeBlockVisibilityProvider isVisible={isVisible}>
        <MessageThread
          className="flex-1 min-h-0"
          resize={shouldUseSmoothResize ? "smooth" : undefined}
        >
          <AutoScrollOnSend signal={sendSignal} />
          <VirtualizedMessageThread
            items={threadItems}
            getItemKey={(item) => item.key}
            renderItem={renderThreadItem}
            emptyState={emptyState}
            estimateSize={180}
            overscan={virtualizedOverscan}
          />
          <MessageThreadScrollButton
            className="bottom-2 right-4 left-auto translate-x-0 shadow-md"
            title={tThread("scrollToBottom")}
            aria-label={tThread("scrollToBottom")}
            size="icon-sm"
          />
        </MessageThread>
      </CodeBlockVisibilityProvider>
      {liveMessage && connStatus === "prompting" && (
        <LiveTurnStats
          message={liveMessage}
          agentType={agentType}
          isStreaming={connStatus === "prompting"}
        />
      )}
      <AgentPlanOverlay
        key={agentPlanOverlayKey}
        message={liveMessage ?? null}
        entries={historicalPlanEntries}
        planKey={historicalPlanKey}
        defaultExpanded={connStatus === "prompting"}
      />
    </div>
  )
}
