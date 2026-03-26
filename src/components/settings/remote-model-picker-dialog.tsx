"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { RemoteModelInfo } from "@/lib/types"

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function fuzzyScore(candidate: string, query: string): number {
  const normalizedCandidate = normalizeText(candidate)
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return 1
  if (normalizedCandidate.includes(normalizedQuery)) {
    return normalizedQuery.length * 10
  }

  let score = 0
  let queryIndex = 0
  for (let index = 0; index < normalizedCandidate.length; index += 1) {
    if (normalizedCandidate[index] !== normalizedQuery[queryIndex]) {
      continue
    }
    score += 1
    queryIndex += 1
    if (queryIndex === normalizedQuery.length) {
      return score
    }
  }

  return 0
}

function filterModels(
  models: RemoteModelInfo[],
  query: string
): RemoteModelInfo[] {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return [...models].sort((left, right) => left.id.localeCompare(right.id))
  }

  return [...models]
    .map((model) => {
      const searchable = `${model.id} ${model.name} ${model.owned_by ?? ""}`
      return {
        model,
        score: fuzzyScore(searchable, normalizedQuery),
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }
      return left.model.id.localeCompare(right.model.id)
    })
    .map((entry) => entry.model)
}

interface ModelSelectorFieldProps {
  value: string
  onChange: (value: string) => void
  models: RemoteModelInfo[]
  placeholder?: string
  disabled?: boolean
  emptyText?: string
}

export function ModelSelectorField({
  value,
  onChange,
  models,
  placeholder,
  disabled = false,
  emptyText,
}: ModelSelectorFieldProps) {
  const t = useTranslations("AcpAgentSettings.modelSelector")
  const [open, setOpen] = useState(false)
  const filteredModels = useMemo(
    () => filterModels(models, value),
    [models, value]
  )

  return (
    <Popover open={!disabled && open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div>
          <Input
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              if (!open) {
                setOpen(true)
              }
            }}
            onFocus={() => {
              if (models.length > 0) {
                setOpen(true)
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[420px] gap-2 p-2">
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>{t("filterHint")}</span>
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-md border bg-muted/10">
          {filteredModels.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyText ?? t("empty")}
            </div>
          ) : (
            <div className="divide-y">
              {filteredModels.map((model) => {
                return (
                  <button
                    key={model.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    onMouseDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <div className="truncate text-sm font-medium">
                        {model.name && model.name !== model.id
                          ? model.name
                          : model.id}
                      </div>
                      {model.context_window ? (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {model.context_window >= 1000000
                            ? `${(model.context_window / 1000000).toFixed(model.context_window % 1000000 === 0 ? 0 : 1)}M ctx`
                            : model.context_window >= 1000
                              ? `${Math.round(model.context_window / 1000)}K ctx`
                              : `${model.context_window} ctx`}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" />
                      {t("select")}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
