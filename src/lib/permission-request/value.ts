import type { ObjectLike } from "./types"

export function asObject(value: unknown): ObjectLike | null {
  if (!value) return null
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as ObjectLike
  }
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ObjectLike)
      : null
  } catch {
    return null
  }
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

export function pickValue(record: ObjectLike | null, keys: string[]): unknown {
  if (!record) return null
  for (const key of keys) {
    if (!(key in record)) continue
    const value = record[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

export function pickString(
  record: ObjectLike | null,
  keys: string[]
): string | null {
  const value = pickValue(record, keys)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function joinNonEmptyStrings(values: unknown): string | null {
  if (!Array.isArray(values)) return null
  const parts = values.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )
  return parts.length > 0 ? parts.join(" ") : null
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? "")
  }
}
