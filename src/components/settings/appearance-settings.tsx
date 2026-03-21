"use client"

import { MessageSquareText, Monitor, Moon, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useChatDisplaySettings } from "@/hooks/use-chat-display-settings"

type ThemeMode = "system" | "light" | "dark"

export function AppearanceSettings() {
  const t = useTranslations("AppearanceSettings")
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { settings, setAutoCollapseLongUserMessages } = useChatDisplaySettings()
  const resolvedThemeLabel =
    resolvedTheme === "dark"
      ? t("resolvedTheme.dark")
      : resolvedTheme === "light"
        ? t("resolvedTheme.light")
        : t("resolvedTheme.unknown")

  return (
    <div className="h-full overflow-auto">
      <div className="w-full space-y-4">
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("sectionTitle")}</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-5">
            {t("sectionDescription")}
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("themeMode")}
            </label>
            <Select
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value as ThemeMode)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t("placeholder")} />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="system">
                  <span className="inline-flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5" />
                    {t("system")}
                  </span>
                </SelectItem>
                <SelectItem value="light">
                  <span className="inline-flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" />
                    {t("light")}
                  </span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="inline-flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5" />
                    {t("dark")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              className="text-[11px] text-muted-foreground"
              suppressHydrationWarning
            >
              {t("currentTheme", { theme: resolvedThemeLabel })}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {t("messageSectionTitle")}
            </h2>
          </div>

          <p className="text-xs text-muted-foreground leading-5">
            {t("messageSectionDescription")}
          </p>

          <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {t("autoCollapseLongUserMessages")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("autoCollapseLongUserMessagesDescription")}
              </p>
            </div>
            <Switch
              checked={settings.autoCollapseLongUserMessages}
              onCheckedChange={setAutoCollapseLongUserMessages}
              aria-label={t("autoCollapseLongUserMessagesAria")}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
