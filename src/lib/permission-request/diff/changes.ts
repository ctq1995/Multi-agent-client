import type { ObjectLike, PermissionFileChange } from "../types"
import { asArray, asObject, pickString, pickValue } from "../value"
import { collectDiffPaths, extractDiffPreview } from "./detect"
import { buildDiffPreviewFromChanges } from "./preview"

function parseChangeRecord(
  path: string,
  value: unknown
): PermissionFileChange | null {
  const normalizedPath = path.trim()
  if (!normalizedPath) return null

  if (typeof value === "string") {
    return {
      path: normalizedPath,
      oldText: "",
      newText: value,
      unifiedDiff: undefined,
    }
  }

  const record = asObject(value)
  if (!record) {
    return { path: normalizedPath, oldText: "", newText: "" }
  }

  const oldText =
    pickString(record, [
      "old_string",
      "oldString",
      "old_text",
      "oldText",
      "old",
      "before",
    ]) ?? ""
  const newText =
    pickString(record, [
      "new_string",
      "newString",
      "new_text",
      "newText",
      "new",
      "after",
      "content",
      "text",
      "new_source",
      "newSource",
    ]) ?? ""
  const unifiedDiff =
    pickString(record, ["unifiedDiff", "unified_diff", "diff", "patch"]) ??
    undefined

  return { path: normalizedPath, oldText, newText, unifiedDiff }
}

function extractRawInputFileChanges(
  rawInputObj: ObjectLike | null
): PermissionFileChange[] {
  if (!rawInputObj) return []

  const changes: PermissionFileChange[] = []

  const byChangesObject = asObject(rawInputObj.changes)
  if (byChangesObject) {
    for (const [path, value] of Object.entries(byChangesObject)) {
      const parsed = parseChangeRecord(path, value)
      if (parsed) changes.push(parsed)
    }
  }

  const listCandidates = [
    pickValue(rawInputObj, [
      "files",
      "file_changes",
      "fileChanges",
      "edits",
      "patches",
      "diffs",
    ]),
    pickValue(rawInputObj, ["changes_list", "change_list"]),
  ]
  for (const candidate of listCandidates) {
    const list = asArray(candidate)
    if (!list) continue
    for (const item of list) {
      const record = asObject(item)
      if (!record) {
        if (typeof item === "string") {
          const value = item.trim()
          if (value.length > 0) {
            changes.push({
              path: value,
              oldText: "",
              newText: "",
              unifiedDiff: undefined,
            })
          }
        }
        continue
      }
      const path =
        pickString(record, [
          "file_path",
          "filePath",
          "path",
          "file",
          "target_file",
          "targetFile",
          "notebook_path",
        ]) ?? null
      if (!path) continue
      const parsed = parseChangeRecord(path, record)
      if (parsed) changes.push(parsed)
    }
  }

  const directPath =
    pickString(rawInputObj, [
      "file_path",
      "filePath",
      "path",
      "notebook_path",
      "target_file",
      "targetFile",
    ]) ?? null

  if (directPath) {
    const oldText =
      pickString(rawInputObj, [
        "old_string",
        "oldString",
        "old_text",
        "oldText",
      ]) ?? ""
    const newText =
      pickString(rawInputObj, [
        "new_string",
        "newString",
        "new_text",
        "newText",
        "content",
        "text",
        "new_source",
      ]) ?? ""

    if (oldText || newText || changes.length === 0) {
      changes.push({
        path: directPath,
        oldText,
        newText,
        unifiedDiff: undefined,
      })
    }
  }

  return changes
}

function extractContentDiffChanges(
  toolCallObj: ObjectLike | null
): PermissionFileChange[] {
  if (!toolCallObj) return []
  const content = asArray(toolCallObj.content)
  if (!content) return []

  const changes: PermissionFileChange[] = []
  for (const item of content) {
    const record = asObject(item)
    if (!record) continue
    const type = pickString(record, ["type"])?.toLowerCase()
    if (type !== "diff") continue

    const path = pickString(record, ["path"])
    if (!path) continue
    changes.push({
      path,
      oldText: pickString(record, ["old_text", "oldText"]) ?? "",
      newText: pickString(record, ["new_text", "newText"]) ?? "",
      unifiedDiff: undefined,
    })
  }
  return changes
}

function collectLocationPaths(toolCallObj: ObjectLike | null): string[] {
  if (!toolCallObj) return []
  const locations = asArray(toolCallObj.locations)
  if (!locations) return []

  const paths: string[] = []
  for (const item of locations) {
    const record = asObject(item)
    if (!record) continue
    const path = pickString(record, ["path"])
    if (path) paths.push(path)
  }
  return paths
}

function mergeFileChanges(
  changes: PermissionFileChange[]
): PermissionFileChange[] {
  const merged = new Map<string, PermissionFileChange>()
  for (const change of changes) {
    const path = change.path.trim()
    if (!path) continue
    const prev = merged.get(path)
    if (!prev) {
      merged.set(path, { ...change, path })
      continue
    }

    const oldText = prev.oldText || change.oldText
    const newText = prev.newText || change.newText
    const unifiedDiff = prev.unifiedDiff || change.unifiedDiff
    merged.set(path, { path, oldText, newText, unifiedDiff })
  }
  return Array.from(merged.values())
}

export interface ParsedDiffBundle {
  fileChanges: PermissionFileChange[]
  diffPreview: string | null
}

export function extractDiffBundle(
  toolCallObj: ObjectLike | null,
  rawInputValue: unknown
): ParsedDiffBundle {
  const rawInputObj = asObject(rawInputValue)
  const explicitDiffPreview = extractDiffPreview(rawInputValue, rawInputObj)
  const rawInputFileChanges = extractRawInputFileChanges(rawInputObj)
  const contentDiffChanges = extractContentDiffChanges(toolCallObj)
  const locationPaths = collectLocationPaths(toolCallObj)
  const diffPaths = collectDiffPaths(explicitDiffPreview)

  const combinedChanges = mergeFileChanges([
    ...rawInputFileChanges,
    ...contentDiffChanges,
    ...locationPaths.map((path) => ({
      path,
      oldText: "",
      newText: "",
      unifiedDiff: undefined,
    })),
    ...diffPaths.map((path) => ({
      path,
      oldText: "",
      newText: "",
      unifiedDiff: undefined,
    })),
  ])

  const diffPreview =
    explicitDiffPreview ?? buildDiffPreviewFromChanges(combinedChanges)
  return { fileChanges: combinedChanges, diffPreview }
}
