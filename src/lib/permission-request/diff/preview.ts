import type { PermissionFileChange } from "../types"
import { splitNormalizedLines } from "@/lib/line-change-stats"

const DEFAULT_DIFF_CONTEXT_LINES = 2
const DIFF_PREVIEW_MAX_FILES = 8
const DIFF_PREVIEW_MAX_LINES = 1200

function buildCompactDiffFromTexts(
  path: string,
  oldText: string,
  newText: string,
  contextLines: number
): string | null {
  const oldLines = splitNormalizedLines(oldText)
  const newLines = splitNormalizedLines(newText)

  let prefix = 0
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] ===
      newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const removed = oldLines.slice(prefix, oldLines.length - suffix)
  const added = newLines.slice(prefix, newLines.length - suffix)
  if (removed.length === 0 && added.length === 0) return null

  const before = oldLines.slice(Math.max(0, prefix - contextLines), prefix)
  const after = oldLines.slice(
    oldLines.length - suffix,
    Math.min(oldLines.length, oldLines.length - suffix + contextLines)
  )

  const parts: string[] = [`--- ${path}`, `+++ ${path}`]
  for (const line of before) parts.push(` ${line}`)
  for (const line of removed) parts.push(`-${line}`)
  for (const line of added) parts.push(`+${line}`)
  for (const line of after) parts.push(` ${line}`)

  return parts.join("\n")
}

export function buildDiffPreviewFromChanges(
  changes: PermissionFileChange[]
): string | null {
  const meaningful = changes.filter((change) => {
    if (
      typeof change.unifiedDiff === "string" &&
      change.unifiedDiff.trim().length > 0
    ) {
      return true
    }
    return change.oldText.length > 0 || change.newText.length > 0
  })
  if (meaningful.length === 0) return null

  const limited = meaningful.slice(0, DIFF_PREVIEW_MAX_FILES)
  const lines: string[] = []
  let lineCount = 0
  let truncated = false

  const pushLine = (line: string) => {
    if (lineCount >= DIFF_PREVIEW_MAX_LINES) {
      truncated = true
      return
    }
    lines.push(line)
    lineCount += 1
  }

  for (const change of limited) {
    const block =
      typeof change.unifiedDiff === "string" &&
      change.unifiedDiff.trim().length > 0
        ? change.unifiedDiff.trim()
        : buildCompactDiffFromTexts(
            change.path,
            change.oldText,
            change.newText,
            DEFAULT_DIFF_CONTEXT_LINES
          )
    if (!block) continue

    for (const line of block.split("\n")) {
      pushLine(line)
      if (truncated) break
    }
    if (truncated) break
    pushLine("")
  }

  if (meaningful.length > limited.length) {
    lines.push(`# ... ${meaningful.length - limited.length} more files omitted`)
  }
  if (truncated) {
    lines.push("# ... diff preview truncated")
  }

  const preview = lines.join("\n").trim()
  return preview.length > 0 ? preview : null
}
