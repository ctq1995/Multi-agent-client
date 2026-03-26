"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, User, Bot, ArrowDown, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdaptedContentPart } from "@/lib/adapters/ai-elements-adapter"

export interface TurnRound {
  /** DOM id of the user turn element */
  turnId: string
  /** User message text summary */
  userSummary: string
  /** Assistant reply summary (empty if not yet replied) */
  assistantSummary: string
  /** Whether the assistant turn has tool calls */
  hasTools: boolean
}

const HIDE_DELAY = 150

function extractTextSummary(parts: AdaptedContentPart[], maxLen = 40): string {
  for (const part of parts) {
    if (part.type === "text" && part.text.trim()) {
      const t = part.text.trim()
      return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + "…"
    }
  }
  return ""
}

function hasToolCallParts(parts: AdaptedContentPart[]): boolean {
  return parts.some((p) => p.type === "tool-call")
}

interface TurnNavigatorProps {
  rounds: TurnRound[]
  currentRoundIndex: number
  onScrollToRound: (index: number) => void
  onScrollToBottom: () => void
  onClose: () => void
}

export const TurnNavigator = memo(function TurnNavigator({
  rounds,
  currentRoundIndex,
  onScrollToRound,
  onScrollToBottom,
  onClose,
}: TurnNavigatorProps) {
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  const isHoveringBallRef = useRef(false)
  const isHoveringPanelRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentItemRef = useRef<HTMLDivElement>(null)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringBallRef.current && !isHoveringPanelRef.current) {
        setIsPanelVisible(false)
      }
    }, HIDE_DELAY)
  }, [clearHideTimer])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  // Scroll active item into view when panel opens or active round changes
  useEffect(() => {
    if (isPanelVisible && currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [isPanelVisible, currentRoundIndex])

  const handleRoundClick = useCallback(
    (index: number) => {
      onScrollToRound(index)
      setIsPanelVisible(false)
    },
    [onScrollToRound]
  )

  const handleScrollToBottom = useCallback(() => {
    onScrollToBottom()
    setIsPanelVisible(false)
  }, [onScrollToBottom])

  const panelStyle = useMemo(
    () => ({ right: "72px", top: "50%", transform: "translateY(-50%)", maxHeight: "70vh" }),
    []
  )

  if (rounds.length === 0) return null

  return (
    <>
      {/* Floating ball */}
      <div
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 z-20",
          "w-10 h-10 rounded-full",
          "bg-primary/90 backdrop-blur-sm",
          "shadow-lg shadow-primary/20",
          "flex items-center justify-center cursor-pointer",
          "transition-all duration-200 hover:scale-110 hover:bg-primary"
        )}
        onMouseEnter={() => {
          isHoveringBallRef.current = true
          clearHideTimer()
          setIsPanelVisible(true)
        }}
        onMouseLeave={() => {
          isHoveringBallRef.current = false
          scheduleHide()
        }}
      >
        <BookOpen className="w-4 h-4 text-white" />
      </div>

      {/* Flyout panel */}
      {isPanelVisible && (
        <div
          className={cn(
            "absolute w-60 bg-card/95 backdrop-blur-sm",
            "border border-border rounded-lg shadow-lg shadow-primary/10",
            "overflow-hidden flex flex-col",
            "z-20"
          )}
          style={panelStyle}
          onMouseEnter={() => {
            isHoveringPanelRef.current = true
            clearHideTimer()
          }}
          onMouseLeave={() => {
            isHoveringPanelRef.current = false
            scheduleHide()
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              对话导航
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{rounds.length} 轮</span>
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="关闭导航"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Round list */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {rounds.map((round, idx) => (
              <div
                key={round.turnId}
                ref={idx === currentRoundIndex ? currentItemRef : null}
                className={cn(
                  "px-3 py-2 border-b border-border/50 cursor-pointer transition-colors",
                  "hover:bg-muted/50",
                  idx === currentRoundIndex && "bg-primary/10 border-l-2 border-l-primary"
                )}
                onClick={() => handleRoundClick(idx)}
              >
                {/* Round header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1 py-0.5">
                    #{idx + 1}
                  </span>
                  {round.hasTools && (
                    <Wrench className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* User summary */}
                <div className="flex items-start gap-1.5 mb-1">
                  <User className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                    {round.userSummary || "[图片/文件]"}
                  </p>
                </div>

                {/* Assistant summary */}
                {round.assistantSummary ? (
                  <div className="flex items-start gap-1.5">
                    <Bot className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <p className={cn(
                      "text-xs leading-relaxed line-clamp-1",
                      idx === currentRoundIndex ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}>
                      {round.assistantSummary}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <Bot className="w-3 h-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground/50 italic">等待回复...</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-muted/20 shrink-0">
            <button
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              onClick={handleScrollToBottom}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              回到底部
            </button>
          </div>
        </div>
      )}
    </>
  )
})

export { extractTextSummary, hasToolCallParts }
