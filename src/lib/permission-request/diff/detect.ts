import type { ObjectLike } from "../types"
import { unescapeInlineEscapes } from "../text"

export function looksLikeDiffPayload(input: string): boolean {
  const normalized = unescapeInlineEscapes(input)
  return (
    normalized.includes("*** Begin Patch") ||
    normalized.includes("*** Update File:") ||
    /^diff --git /m.test(normalized) ||
    (/^--- .+/m.test(normalized) && /^\+\+\+ .+/m.test(normalized)) ||
    /^@@ /m.test(normalized)
  )
}

export function collectDiffPaths(diffText: string | null): string[] {
  if (!diffText) return []
  const paths = new Set<string>()
  for (const line of diffText.split("\n")) {
    if (line.startsWith("*** Add File: ")) {
      paths.add(line.slice(14).trim())
      continue
    }
    if (line.startsWith("*** Update File: ")) {
      paths.add(line.slice(17).trim())
      continue
    }
    if (line.startsWith("*** Delete File: ")) {
      paths.add(line.slice(17).trim())
      continue
    }
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).replace(/^b\//, "").trim()
      if (path && path !== "/dev/null") paths.add(path)
    }
  }
  return Array.from(paths)
}

export function extractDiffPreview(
  rawInput: unknown,
  rawInputObj: ObjectLike | null
): string | null {
  const candidates: unknown[] = [rawInput]
  if (rawInputObj) {
    candidates.push(
      rawInputObj.patch,
      rawInputObj.diff,
      rawInputObj.unified_diff,
      rawInputObj.unifiedDiff
    )
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue
    const normalized = unescapeInlineEscapes(candidate).trim()
    if (!normalized) continue
    if (looksLikeDiffPayload(normalized)) return normalized
  }

  return null
}
