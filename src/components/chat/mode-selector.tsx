"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropdownRadioItemContent } from "@/components/chat/dropdown-radio-item-content"
import type { SessionModeInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ModeSelectorProps {
  modes: SessionModeInfo[]
  selectedModeId: string | null
  onSelect: (modeId: string) => void
}

function PillModeSelector({
  modes,
  selectedModeId,
  onSelect,
}: ModeSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{
    left: number
    width: number
  } | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container || !selectedModeId) {
      setIndicator(null)
      return
    }
    const btn = itemRefs.current.get(selectedModeId)
    if (!btn) {
      setIndicator(null)
      return
    }
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setIndicator({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    })
  }, [selectedModeId])

  useEffect(() => {
    measure()
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, [measure])

  const setItemRef = useCallback(
    (modeId: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        itemRefs.current.set(modeId, el)
      } else {
        itemRefs.current.delete(modeId)
      }
    },
    []
  )

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center self-center rounded-full bg-muted/60 p-1 border border-border/50"
    >
      {indicator && (
        <div
          className="absolute top-1 bottom-1 rounded-full bg-background shadow-md ring-1 ring-border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {modes.map((mode) => {
        const isSelected = mode.id === selectedModeId
        return (
          <button
            key={mode.id}
            ref={setItemRef(mode.id)}
            type="button"
            title={mode.description ?? mode.name}
            onClick={() => onSelect(mode.id)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
              isSelected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80 cursor-pointer"
            )}
          >
            <span className="truncate max-w-[80px]">{mode.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ModeSelector({
  modes,
  selectedModeId,
  onSelect,
}: ModeSelectorProps) {
  if (modes.length <= 4) {
    return (
      <PillModeSelector
        modes={modes}
        selectedModeId={selectedModeId}
        onSelect={onSelect}
      />
    )
  }

  const selectedMode = modes.find((m) => m.id === selectedModeId)
  const label = selectedMode?.name ?? "Mode"
  const isActive = Boolean(selectedMode)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className={cn("gap-1 min-w-0", isActive && "text-primary")}
          title={selectedMode?.description ?? selectedMode?.name}
        >
          <span className="truncate">{label}</span>
          <ChevronUp className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-72">
        <DropdownMenuRadioGroup
          value={selectedModeId ?? ""}
          onValueChange={onSelect}
        >
          {modes.map((mode) => (
            <DropdownMenuRadioItem key={mode.id} value={mode.id}>
              <DropdownRadioItemContent
                label={mode.name}
                description={mode.description}
              />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
