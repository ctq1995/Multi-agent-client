"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CHAT_DISPLAY_SETTINGS_STORAGE_KEY,
  CHAT_DISPLAY_SETTINGS_UPDATED_EVENT,
  DEFAULT_CHAT_DISPLAY_SETTINGS,
  readChatDisplaySettings,
  type ChatDisplaySettings,
  writeChatDisplaySettings,
} from "@/lib/chat-display-settings"

interface UseChatDisplaySettingsResult {
  settings: ChatDisplaySettings
  setAutoCollapseLongUserMessages: (enabled: boolean) => void
  setShowTurnNavigator: (enabled: boolean) => void
  resetChatDisplaySettings: () => void
}

export function useChatDisplaySettings(): UseChatDisplaySettingsResult {
  const [settings, setSettings] = useState<ChatDisplaySettings>(
    DEFAULT_CHAT_DISPLAY_SETTINGS
  )

  useEffect(() => {
    const syncFromStorage = () => {
      setSettings(readChatDisplaySettings())
    }

    syncFromStorage()

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CHAT_DISPLAY_SETTINGS_STORAGE_KEY) return
      syncFromStorage()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(
      CHAT_DISPLAY_SETTINGS_UPDATED_EVENT,
      syncFromStorage
    )

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(
        CHAT_DISPLAY_SETTINGS_UPDATED_EVENT,
        syncFromStorage
      )
    }
  }, [])

  const setAutoCollapseLongUserMessages = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        autoCollapseLongUserMessages: enabled,
      }
      writeChatDisplaySettings(next)
      return next
    })
  }, [])

  const setShowTurnNavigator = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, showTurnNavigator: enabled }
      writeChatDisplaySettings(next)
      return next
    })
  }, [])

  const resetChatDisplaySettings = useCallback(() => {
    setSettings(DEFAULT_CHAT_DISPLAY_SETTINGS)
    writeChatDisplaySettings(DEFAULT_CHAT_DISPLAY_SETTINGS)
  }, [])

  return {
    settings,
    setAutoCollapseLongUserMessages,
    setShowTurnNavigator,
    resetChatDisplaySettings,
  }
}
