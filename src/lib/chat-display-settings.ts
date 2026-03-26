"use client"

export interface ChatDisplaySettings {
  autoCollapseLongUserMessages: boolean
  showTurnNavigator: boolean
}

export const DEFAULT_CHAT_DISPLAY_SETTINGS: ChatDisplaySettings = {
  autoCollapseLongUserMessages: true,
  showTurnNavigator: true,
}

export const CHAT_DISPLAY_SETTINGS_STORAGE_KEY = "settings:chat-display:v1"
export const CHAT_DISPLAY_SETTINGS_UPDATED_EVENT =
  "codeg:chat-display-settings-updated"

function normalizeChatDisplaySettings(input: unknown): ChatDisplaySettings {
  const next: ChatDisplaySettings = { ...DEFAULT_CHAT_DISPLAY_SETTINGS }
  if (!input || typeof input !== "object") return next

  const record = input as Record<string, unknown>
  if (typeof record.autoCollapseLongUserMessages === "boolean") {
    next.autoCollapseLongUserMessages = record.autoCollapseLongUserMessages
  }
  if (typeof record.showTurnNavigator === "boolean") {
    next.showTurnNavigator = record.showTurnNavigator
  }

  return next
}

export function readChatDisplaySettings(): ChatDisplaySettings {
  if (typeof window === "undefined") return { ...DEFAULT_CHAT_DISPLAY_SETTINGS }

  try {
    const raw = window.localStorage.getItem(CHAT_DISPLAY_SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CHAT_DISPLAY_SETTINGS }
    return normalizeChatDisplaySettings(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_CHAT_DISPLAY_SETTINGS }
  }
}

export function writeChatDisplaySettings(settings: ChatDisplaySettings): void {
  if (typeof window === "undefined") return

  const normalized = normalizeChatDisplaySettings(settings)

  try {
    window.localStorage.setItem(
      CHAT_DISPLAY_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized)
    )
    window.dispatchEvent(new Event(CHAT_DISPLAY_SETTINGS_UPDATED_EVENT))
  } catch {
    // Ignore storage failures (e.g. disabled storage).
  }
}
