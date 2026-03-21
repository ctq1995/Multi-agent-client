import type { ObjectLike } from "./types"
import { joinNonEmptyStrings } from "./value"
import { looksLikeDiffPayload } from "./diff"

export function extractCommandFromUnknownValue(
  value: unknown,
  depth: number = 0
): string | null {
  if (depth > 4 || value === null || value === undefined) return null

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed || looksLikeDiffPayload(trimmed)) return null
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return trimmed
    }
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return extractCommandFromUnknownValue(parsed, depth + 1)
    } catch {
      return null
    }
  }

  if (Array.isArray(value)) {
    const joined = joinNonEmptyStrings(value)
    return joined && joined.trim().length > 0 ? joined.trim() : null
  }

  if (typeof value !== "object") return null
  const obj = value as ObjectLike

  const directKeys = [
    "command",
    "cmd",
    "script",
    "args",
    "argv",
    "command_args",
  ]
  for (const key of directKeys) {
    const direct = extractCommandFromUnknownValue(obj[key], depth + 1)
    if (direct) return direct
  }

  const nestedKeys = [
    "rawInput",
    "raw_input",
    "input",
    "arguments",
    "params",
    "payload",
    // OpenAI tool calls nest arguments under `function.arguments`.
    "function",
  ]
  for (const key of nestedKeys) {
    const nested = extractCommandFromUnknownValue(obj[key], depth + 1)
    if (nested) return nested
  }

  return null
}
