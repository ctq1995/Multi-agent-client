export type ObjectLike = Record<string, unknown>

export interface PermissionFileChange {
  path: string
  oldText: string
  newText: string
  unifiedDiff?: string
}

export interface PermissionPlanEntry {
  text: string
  status: string | null | undefined
}

export interface PermissionAllowedPrompt {
  prompt: string
  tool: string
}

export interface ParsedPermissionToolCall {
  title: string
  normalizedKind: string
  command: string | null
  cwd: string | null
  fileChanges: PermissionFileChange[]
  additions: number
  deletions: number
  diffPreview: string | null
  planEntries: PermissionPlanEntry[]
  planExplanation: string | null
  planMarkdown: string | null
  allowedPrompts: PermissionAllowedPrompt[]
  modeTarget: string | null
  url: string | null
  query: string | null
  prompt: string | null
  jsonPreview: string | null
}
