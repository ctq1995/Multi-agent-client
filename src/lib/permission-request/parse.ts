import { normalizeToolName } from "@/lib/tool-call-normalization"
import {
  countUnifiedDiffLineChanges,
  estimateChangedLineStats,
} from "@/lib/line-change-stats"
import type { ObjectLike, ParsedPermissionToolCall } from "./types"
import { extractCommandFromUnknownValue } from "./command"
import { extractDiffBundle } from "./diff"
import { parseAllowedPrompts, parsePlanBundle } from "./plan"
import { asObject, pickString, pickValue, stringifyJson } from "./value"

const TOOL_KIND_KEYS = [
  "kind",
  "tool_name",
  "toolName",
  "name",
  "type",
] as const
const TOOL_TITLE_KEYS = ["title", "tool_name", "toolName", "name"] as const
const RAW_INPUT_KEYS = [
  "rawInput",
  "raw_input",
  "input",
  "arguments",
  "params",
  "payload",
] as const
const CWD_KEYS = [
  "cwd",
  "workdir",
  "working_directory",
  "workingDirectory",
] as const
const MODE_TARGET_KEYS = [
  "mode_id",
  "modeId",
  "target_mode",
  "targetMode",
] as const
const WEB_URL_KEYS = ["url"] as const
const WEB_QUERY_KEYS = ["query"] as const
const WEB_PROMPT_KEYS = ["prompt"] as const

function formatFallbackTitle(kind: string): string {
  const normalized = kind.replace(/_/g, " ").trim()
  if (!normalized) return "Permission Request"
  return normalized
    .split(/\s+/)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

function extractOpenAiFunctionObject(
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): ObjectLike | null {
  return (
    asObject(pickValue(toolCallObj, ["function"])) ??
    asObject(pickValue(wrapperObj, ["function"])) ??
    null
  )
}

function unwrapToolCallObject(toolCall: unknown): {
  wrapperObj: ObjectLike | null
  toolCallObj: ObjectLike | null
} {
  const wrapperObj = asObject(toolCall)
  const inner =
    asObject(
      pickValue(wrapperObj, ["tool_call", "toolCall", "tool", "call"])
    ) ?? null
  return {
    wrapperObj,
    toolCallObj: inner ?? wrapperObj,
  }
}

function extractNormalizedKind(
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): string {
  const openAiFunction = extractOpenAiFunctionObject(toolCallObj, wrapperObj)
  const openAiName = pickString(openAiFunction, ["name"])
  const rawKind =
    openAiName ??
    pickString(toolCallObj, [...TOOL_KIND_KEYS]) ??
    pickString(wrapperObj, [...TOOL_KIND_KEYS]) ??
    "tool"
  return normalizeToolName(rawKind)
}

function extractRawInputValue(
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): unknown {
  const openAiFunction = extractOpenAiFunctionObject(toolCallObj, wrapperObj)
  const openAiArguments =
    pickValue(openAiFunction, ["arguments", "args", "input", "params"]) ?? null
  return (
    pickValue(toolCallObj, [...RAW_INPUT_KEYS]) ??
    pickValue(wrapperObj, [...RAW_INPUT_KEYS]) ??
    openAiArguments ??
    null
  )
}

function extractCommand(
  rawInputValue: unknown,
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): string | null {
  return (
    extractCommandFromUnknownValue(rawInputValue) ??
    extractCommandFromUnknownValue(toolCallObj) ??
    extractCommandFromUnknownValue(wrapperObj)
  )
}

function extractCwd(
  rawInputObj: ObjectLike | null,
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): string | null {
  return (
    pickString(rawInputObj, [...CWD_KEYS]) ??
    pickString(toolCallObj, [...CWD_KEYS]) ??
    pickString(wrapperObj, [...CWD_KEYS])
  )
}

function computeChangeStats(
  fileChanges: { oldText: string; newText: string; unifiedDiff?: string }[],
  diffPreview: string | null
): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0

  if (diffPreview) {
    const stats = countUnifiedDiffLineChanges(diffPreview)
    return { additions: stats.additions, deletions: stats.deletions }
  }

  for (const change of fileChanges) {
    const diff =
      typeof change.unifiedDiff === "string" ? change.unifiedDiff.trim() : ""
    if (diff) {
      const stats = countUnifiedDiffLineChanges(diff)
      additions += stats.additions
      deletions += stats.deletions
      continue
    }

    const stats = estimateChangedLineStats(change.oldText, change.newText)
    additions += stats.additions
    deletions += stats.deletions
  }

  return { additions, deletions }
}

function extractModeTarget(
  rawInputObj: ObjectLike | null,
  toolCallObj: ObjectLike | null
): string | null {
  return (
    pickString(rawInputObj, [...MODE_TARGET_KEYS]) ??
    pickString(toolCallObj, [...MODE_TARGET_KEYS]) ??
    null
  )
}

function extractWeb(
  rawInputObj: ObjectLike | null,
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null
): { url: string | null; query: string | null; prompt: string | null } {
  const url =
    pickString(rawInputObj, [...WEB_URL_KEYS]) ??
    pickString(toolCallObj, [...WEB_URL_KEYS]) ??
    pickString(wrapperObj, [...WEB_URL_KEYS]) ??
    null
  const query =
    pickString(rawInputObj, [...WEB_QUERY_KEYS]) ??
    pickString(toolCallObj, [...WEB_QUERY_KEYS]) ??
    pickString(wrapperObj, [...WEB_QUERY_KEYS]) ??
    null
  const prompt =
    pickString(rawInputObj, [...WEB_PROMPT_KEYS]) ??
    pickString(toolCallObj, [...WEB_PROMPT_KEYS]) ??
    pickString(wrapperObj, [...WEB_PROMPT_KEYS]) ??
    null

  return { url, query, prompt }
}

function extractTitle(
  toolCallObj: ObjectLike | null,
  wrapperObj: ObjectLike | null,
  normalizedKind: string
): string {
  const openAiFunction = extractOpenAiFunctionObject(toolCallObj, wrapperObj)
  const openAiName = pickString(openAiFunction, ["name"])
  return (
    pickString(toolCallObj, [...TOOL_TITLE_KEYS]) ??
    pickString(wrapperObj, [...TOOL_TITLE_KEYS]) ??
    openAiName ??
    formatFallbackTitle(normalizedKind)
  )
}

export function parsePermissionToolCall(
  toolCall: unknown
): ParsedPermissionToolCall {
  const { wrapperObj, toolCallObj } = unwrapToolCallObject(toolCall)

  const normalizedKind = extractNormalizedKind(toolCallObj, wrapperObj)
  const rawInputValue = extractRawInputValue(toolCallObj, wrapperObj)
  const rawInputObj = asObject(rawInputValue)

  const command = extractCommand(rawInputValue, toolCallObj, wrapperObj)
  const cwd = extractCwd(rawInputObj, toolCallObj, wrapperObj)
  const { fileChanges, diffPreview } = extractDiffBundle(
    toolCallObj,
    rawInputValue
  )
  const stats = computeChangeStats(fileChanges, diffPreview)
  const plan = parsePlanBundle(rawInputObj)
  const allowedPrompts = parseAllowedPrompts(rawInputObj)
  const modeTarget = extractModeTarget(rawInputObj, toolCallObj)
  const web = extractWeb(rawInputObj, toolCallObj, wrapperObj)
  const title = extractTitle(toolCallObj, wrapperObj, normalizedKind)

  return {
    title,
    normalizedKind,
    command,
    cwd,
    fileChanges,
    additions: stats.additions,
    deletions: stats.deletions,
    diffPreview,
    planEntries: plan.entries,
    planExplanation: plan.explanation,
    planMarkdown: plan.markdown,
    allowedPrompts,
    modeTarget,
    url: web.url,
    query: web.query,
    prompt: web.prompt,
    jsonPreview: stringifyJson(wrapperObj ?? toolCallObj ?? toolCall),
  }
}
