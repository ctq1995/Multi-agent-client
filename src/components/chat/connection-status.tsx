import { useTranslations } from "next-intl"
import type { ConnectionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-blue-500 animate-pulse",
  prompting: "bg-yellow-500 animate-pulse",
  error: "bg-red-500",
}

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus | null | undefined
}

export function ConnectionStatusIndicator({
  status,
}: ConnectionStatusIndicatorProps) {
  const t = useTranslations("Chat.connectionStatus")

  if (!status || status === "disconnected") return null

  const color = STATUS_COLORS[status]
  if (!color) return null

  return (
    <div className="px-4 py-1 text-xs text-muted-foreground border-t border-border flex items-center gap-1.5">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", color)} />
      {t(status as "connected" | "connecting" | "prompting" | "error")}
    </div>
  )
}
