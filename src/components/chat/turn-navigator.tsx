"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { ChevronUpIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TurnNavigatorProps {
  userTurnIds: string[]
  onClose: () => void
  scrollContainerRef?: RefObject<HTMLElement | null>
}

export const TurnNavigator = memo(function TurnNavigator({
  userTurnIds,
  onClose,
  scrollContainerRef,
}: TurnNavigatorProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const scrollListRef = useRef<HTMLDivElement>(null)

  // Use IntersectionObserver to track which user turn is currently visible
  useEffect(() => {
    if (userTurnIds.length === 0) return

    const root = (scrollContainerRef?.current as Element | null) ?? null

    const observers: IntersectionObserver[] = []
    const visibleSet = new Set<string>()

    const updateActive = () => {
      // Pick the first visible turn in document order
      for (let i = 0; i < userTurnIds.length; i++) {
        if (visibleSet.has(userTurnIds[i])) {
          setActiveIndex(i)
          return
        }
      }
    }

    userTurnIds.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSet.add(id)
            } else {
              visibleSet.delete(id)
            }
          })
          updateActive()
        },
        { root, threshold: 0.1 }
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => {
      observers.forEach((o) => o.disconnect())
    }
  }, [userTurnIds, scrollContainerRef])

  // Scroll nav pill so active item is visible
  useEffect(() => {
    if (activeIndex < 0 || !scrollListRef.current) return
    const btn = scrollListRef.current.children[activeIndex] as HTMLElement | undefined
    btn?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeIndex])

  const scrollToTurn = useCallback(
    (index: number) => {
      const id = userTurnIds[index]
      if (!id) return
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    [userTurnIds]
  )

  const goPrev = useCallback(() => {
    const target = activeIndex > 0 ? activeIndex - 1 : 0
    scrollToTurn(target)
  }, [activeIndex, scrollToTurn])

  const goNext = useCallback(() => {
    const last = userTurnIds.length - 1
    const target = activeIndex < last ? activeIndex + 1 : last
    scrollToTurn(target)
  }, [activeIndex, userTurnIds.length, scrollToTurn])

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-card/80 px-2 py-1 shadow-lg backdrop-blur">
        {/* Close */}
        <button
          onClick={onClose}
          title="Hide navigator"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <XIcon className="h-3 w-3" />
        </button>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Prev */}
        <button
          onClick={goPrev}
          disabled={activeIndex <= 0}
          title="Previous turn"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUpIcon className="h-3.5 w-3.5" />
        </button>

        {/* Turn number pills */}
        <div
          ref={scrollListRef}
          className="flex max-w-[12rem] items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {userTurnIds.map((id, index) => (
            <button
              key={id}
              onClick={() => scrollToTurn(index)}
              title={`Turn ${index + 1}`}
              className={cn(
                "flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium transition-colors",
                index === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Next */}
        <button
          onClick={goNext}
          disabled={activeIndex >= userTurnIds.length - 1}
          title="Next turn"
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})
