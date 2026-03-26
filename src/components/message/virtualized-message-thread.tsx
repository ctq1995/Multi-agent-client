"use client"

import { useCallback, useRef } from "react"
import type { ReactNode } from "react"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import { useStickToBottomContext } from "use-stick-to-bottom"
import {
  MessageThreadContent,
  type MessageThreadContentProps,
} from "@/components/ai-elements/message-thread"
import { cn } from "@/lib/utils"

interface VirtualizedMessageThreadProps<T> {
  items: T[]
  getItemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  emptyState?: ReactNode
  estimateSize?: number
  overscan?: number
  className?: string
  contentClassName?: string
  contentProps?: Omit<MessageThreadContentProps, "children" | "className">
}

export function VirtualizedMessageThread<T>({
  items,
  getItemKey,
  renderItem,
  emptyState,
  estimateSize = 160,
  overscan = 8,
  className,
  contentClassName,
  contentProps,
}: VirtualizedMessageThreadProps<T>) {
  const { scrollRef } = useStickToBottomContext()
  const measurementCacheRef = useRef(new Map<string, number>())

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = items[index]
      if (!item) {
        return estimateSize
      }

      const cached = measurementCacheRef.current.get(getItemKey(item, index))
      return cached ?? estimateSize
    },
    overscan,
    useAnimationFrameWithResizeObserver: true,
    isScrollingResetDelay: 100,
    paddingStart: 16,
    paddingEnd: 16,
    gap: 32,
    getItemKey: (index) => {
      const item = items[index]
      return item ? getItemKey(item, index) : index
    },
  })

  const measureRowElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return
      }

      const index = Number(element.dataset.index)
      if (!Number.isFinite(index)) {
        return
      }

      const item = items[index]
      if (item) {
        measurementCacheRef.current.set(
          getItemKey(item, index),
          element.getBoundingClientRect().height
        )
      }
      virtualizer.measureElement(element)
    },
    [getItemKey, items, virtualizer]
  )

  const renderVirtualRow = useCallback(
    (virtualItem: VirtualItem) => {
      const item = items[virtualItem.index]
      if (!item) return null

      return (
        <div
          key={virtualItem.key}
          ref={measureRowElement}
          data-index={virtualItem.index}
          className="absolute left-0 top-0 w-full"
          style={{
            transform: `translate3d(0, ${virtualItem.start}px, 0)`,
            willChange: "transform",
          }}
        >
          <div className={cn("mx-auto max-w-3xl px-4", className)}>
            {renderItem(item, virtualItem.index)}
          </div>
        </div>
      )
    },
    [className, items, measureRowElement, renderItem]
  )

  return (
    <MessageThreadContent
      className={cn("mx-0 max-w-none p-0", contentClassName)}
      {...contentProps}
    >
      {items.length === 0 ? (
        (emptyState ?? null)
      ) : (
        <div
          className="relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map(renderVirtualRow)}
        </div>
      )}
    </MessageThreadContent>
  )
}
