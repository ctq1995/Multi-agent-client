"use client"

import { memo, useEffect, useRef } from "react"
import type {
  AdaptedContentPart,
  AdaptedMessage,
  UserImageDisplay,
  UserResourceDisplay,
} from "@/lib/adapters/ai-elements-adapter"
import { ContentPartsRenderer } from "./content-parts-renderer"
import { TurnStats } from "./turn-stats"
import { UserResourceLinks } from "./user-resource-links"
import { UserImageAttachments } from "./user-image-attachments"
import { Message, MessageContent } from "@/components/ai-elements/message"
import { useStickToBottomContext } from "use-stick-to-bottom"

export interface ResolvedMessageGroup {
  id: string
  role: "user" | "assistant" | "system"
  parts: AdaptedContentPart[]
  resources: UserResourceDisplay[]
  images: UserImageDisplay[]
  usage?: import("@/lib/types").TurnUsage | null
  duration_ms?: number | null
  model?: string | null
  models?: string[]
}

export type ThreadRenderItem =
  | {
      key: string
      kind: "turn"
      group: ResolvedMessageGroup
      phase: "persisted" | "optimistic" | "streaming"
    }
  | {
      key: string
      kind: "typing"
    }

export const TYPING_THREAD_ITEM: ThreadRenderItem = {
  key: "typing-pending",
  kind: "typing",
}

const threadTurnItemCache = new WeakMap<
  AdaptedMessage,
  Map<string, Extract<ThreadRenderItem, { kind: "turn" }>>
>()

export function getCachedThreadTurnItem(params: {
  adapted: AdaptedMessage
  phase: "persisted" | "optimistic" | "streaming"
}): Extract<ThreadRenderItem, { kind: "turn" }> {
  const cachedByPhase = threadTurnItemCache.get(params.adapted)
  const cached = cachedByPhase?.get(params.phase)
  if (cached) {
    return cached
  }

  const role =
    params.adapted.role === "tool" ? "assistant" : params.adapted.role
  const item: Extract<ThreadRenderItem, { kind: "turn" }> = {
    key: `turn-${params.adapted.id}`,
    kind: "turn",
    group: {
      id: params.adapted.id,
      role,
      parts: params.adapted.content,
      resources: params.adapted.userResources ?? [],
      images: params.adapted.userImages ?? [],
      usage: params.adapted.usage,
      duration_ms: params.adapted.duration_ms,
      model: params.adapted.model,
    },
    phase: params.phase,
  }
  const nextCachedByPhase =
    cachedByPhase ??
    new Map<string, Extract<ThreadRenderItem, { kind: "turn" }>>()
  nextCachedByPhase.set(params.phase, item)
  threadTurnItemCache.set(params.adapted, nextCachedByPhase)
  return item
}

export const HistoricalMessageGroup = memo(function HistoricalMessageGroup({
  group,
  dimmed = false,
  autoCollapseLongUserMessages = true,
}: {
  group: ResolvedMessageGroup
  dimmed?: boolean
  autoCollapseLongUserMessages?: boolean
}) {
  return (
    <div className={dimmed ? "opacity-70" : undefined}>
      <Message from={group.role}>
        {group.role === "user" && group.images.length > 0 ? (
          <UserImageAttachments images={group.images} className="self-end" />
        ) : null}
        <MessageContent>
          <ContentPartsRenderer
            parts={group.parts}
            role={group.role}
            autoCollapseLongUserMessages={autoCollapseLongUserMessages}
          />
        </MessageContent>
        {group.role === "user" && group.resources.length > 0 ? (
          <UserResourceLinks resources={group.resources} className="self-end" />
        ) : null}
      </Message>
      {group.role === "assistant" && (
        <TurnStats
          usage={group.usage}
          duration_ms={group.duration_ms}
          model={group.model}
          models={group.models}
        />
      )}
    </div>
  )
})

export const PendingTypingIndicator = memo(function PendingTypingIndicator() {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-1.5 py-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </MessageContent>
    </Message>
  )
})

export const AutoScrollOnSend = memo(function AutoScrollOnSend({
  signal,
}: {
  signal: number
}) {
  const { scrollToBottom } = useStickToBottomContext()
  const lastSignalRef = useRef(signal)

  useEffect(() => {
    if (signal === lastSignalRef.current) return
    lastSignalRef.current = signal

    scrollToBottom()
    const rafId = requestAnimationFrame(() => {
      scrollToBottom()
    })
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [scrollToBottom, signal])

  return null
})
