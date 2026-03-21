"use client"

import { useTranslations } from "next-intl"
import Image from "next/image"

const APP_VERSION = "0.1.4"

export function SoftwareInfo() {
  const t = useTranslations("WelcomePage")

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
          {t("softwareVersion", { version: APP_VERSION })}
        </span>
      </div>
    </div>
  )
}
