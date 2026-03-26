"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { getCurrentAppVersion } from "@/lib/updater"

export function SoftwareInfo() {
  const t = useTranslations("WelcomePage")
  const [version, setVersion] = useState<string>("")

  useEffect(() => {
    getCurrentAppVersion().then(setVersion).catch(() => {})
  }, [])

  return (
    <div className="w-full flex gap-4 px-6 py-8">
      <Image
        src="/app-icon.svg"
        alt="Multi-agent-client"
        width={48}
        height={48}
        className="size-12 rounded-xl"
      />
      <div className="flex flex-col">
        <span className="text-base">Multi-agent-client</span>
        <span className="text-sm text-muted-foreground">
          {version ? t("softwareVersion", { version }) : null}
        </span>
      </div>
    </div>
  )
}
