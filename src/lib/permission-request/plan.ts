import type {
  ObjectLike,
  PermissionAllowedPrompt,
  PermissionPlanEntry,
} from "./types"
import { asArray, asObject, pickString, pickValue } from "./value"

function parsePlanEntriesFromList(list: unknown[]): PermissionPlanEntry[] {
  const entries: PermissionPlanEntry[] = []
  for (const item of list) {
    const record = asObject(item)
    if (!record) {
      if (typeof item === "string") {
        const text = item.trim()
        if (text) entries.push({ text, status: null })
      }
      continue
    }
    const text =
      pickString(record, ["step", "content", "title", "task", "description"]) ??
      null
    if (!text) continue
    entries.push({ text, status: pickString(record, ["status", "state"]) })
  }
  return entries
}

function parsePlanEntriesFromUnknown(value: unknown): PermissionPlanEntry[] {
  const list = asArray(value)
  if (list) return parsePlanEntriesFromList(list)

  const obj = asObject(value)
  if (!obj) return []

  const nestedCandidates = [
    pickValue(obj, ["entries"]),
    pickValue(obj, ["steps"]),
    pickValue(obj, ["todos"]),
    pickValue(obj, ["plan"]),
  ]
  for (const nested of nestedCandidates) {
    const parsed = parsePlanEntriesFromUnknown(nested)
    if (parsed.length > 0) return parsed
  }
  return []
}

export interface ParsedPlanBundle {
  entries: PermissionPlanEntry[]
  explanation: string | null
  markdown: string | null
}

export function parsePlanBundle(
  rawInputObj: ObjectLike | null
): ParsedPlanBundle {
  if (!rawInputObj) return { entries: [], explanation: null, markdown: null }

  const planValue = pickValue(rawInputObj, ["plan"])
  const planObj = asObject(planValue)
  const entries = parsePlanEntriesFromUnknown(
    planObj ? pickValue(planObj, ["entries", "steps", "todos"]) : null
  )
    .concat(
      parsePlanEntriesFromUnknown(
        pickValue(rawInputObj, ["entries", "steps", "todos"])
      )
    )
    .filter((entry) => entry.text.trim().length > 0)

  const explanation =
    pickString(planObj, ["explanation", "summary"]) ??
    pickString(rawInputObj, ["explanation"])

  const markdown =
    (typeof planValue === "string" && planValue.trim().length > 0
      ? planValue
      : null) ?? pickString(planObj, ["markdown", "md"])

  const dedup = new Map<string, PermissionPlanEntry>()
  for (const entry of entries) {
    const key = entry.text
    if (!dedup.has(key)) dedup.set(key, entry)
  }

  return {
    entries: Array.from(dedup.values()),
    explanation,
    markdown,
  }
}

export function parseAllowedPrompts(
  rawInputObj: ObjectLike | null
): PermissionAllowedPrompt[] {
  if (!rawInputObj) return []

  const list =
    asArray(pickValue(rawInputObj, ["allowedPrompts", "allowed_prompts"])) ??
    asArray(pickValue(rawInputObj, ["allowedActions", "allowed_actions"])) ??
    asArray(
      pickValue(rawInputObj, [
        "allowed",
        "allowed_tools",
        "allowed_tools_prompts",
      ])
    ) ??
    null

  if (!list || list.length === 0) return []

  const prompts: PermissionAllowedPrompt[] = []
  for (const item of list) {
    const record = asObject(item)
    if (!record) {
      if (typeof item === "string") {
        const prompt = item.trim()
        if (prompt) prompts.push({ prompt, tool: "" })
      }
      continue
    }
    const prompt = pickString(record, [
      "prompt",
      "description",
      "text",
      "action",
    ])
    const tool = pickString(record, ["tool", "toolName", "tool_name", "name"])
    if (prompt) prompts.push({ prompt, tool: tool ?? "" })
  }

  return prompts
}
