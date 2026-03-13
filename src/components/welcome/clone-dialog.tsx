"use client"

import { useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { cloneRepository, openFolderWindow } from "@/lib/tauri"
import { disposeTauriListener } from "@/lib/tauri-listener"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FolderOpen, Loader2 } from "lucide-react"
import { resolveCloneError } from "@/components/welcome/error-utils"

interface CloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GitCloneProgressEventPayload {
  url: string
  target_dir: string
  stage: string | null
  percent: number | null
  message: string
}

const GIT_CLONE_PROGRESS_EVENT = "app://git-clone-progress"

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

function joinFsPath(base: string, suffix: string): string {
  const trimmedBase = base.replace(/[\\/]+$/, "")
  const trimmedSuffix = suffix.replace(/^[\\/]+/, "")
  const separator = trimmedBase.includes("\\") ? "\\" : "/"
  return `${trimmedBase}${separator}${trimmedSuffix}`
}

function deriveRepoName(repoUrl: string): string {
  return (
    repoUrl
      .replace(/\.git$/, "")
      .split("/")
      .pop() ?? "repo"
  )
}

function buildCloneTargetPath(repoUrl: string, baseDir: string): string {
  return joinFsPath(baseDir, deriveRepoName(repoUrl))
}

async function subscribeCloneProgress(
  fullPath: string,
  onProgress: (payload: GitCloneProgressEventPayload) => void
): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null

  return listen<GitCloneProgressEventPayload>(
    GIT_CLONE_PROGRESS_EVENT,
    (event) => {
      if (event.payload.target_dir !== fullPath) return
      onProgress(event.payload)
    }
  )
}

export function CloneDialog({ open: isOpen, onOpenChange }: CloneDialogProps) {
  const t = useTranslations("WelcomePage")
  const [url, setUrl] = useState("")
  const [targetDir, setTargetDir] = useState("")
  const [cloning, setCloning] = useState(false)
  const [progress, setProgress] = useState<{
    percent: number | null
    stage: string | null
    message: string | null
  }>({ percent: null, stage: null, message: null })
  const [error, setError] = useState<{
    message: string
    detail: string | null
  } | null>(null)

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected) {
      setTargetDir(selected)
    }
  }

  const handleClone = async () => {
    if (!url || !targetDir) return

    const fullPath = buildCloneTargetPath(url, targetDir)

    setCloning(true)
    setError(null)
    setProgress({ percent: null, stage: null, message: null })

    let unlisten: UnlistenFn | null = null
    try {
      unlisten = await subscribeCloneProgress(fullPath, (payload) => {
        setProgress((prev) => ({
          percent: payload.percent ?? prev.percent,
          stage: payload.stage,
          message: payload.message,
        }))
      })
    } catch (err) {
      console.warn("[CloneDialog] failed to subscribe clone progress:", err)
      toast.warning(t("toasts.cloneProgressUnavailable"))
    }

    try {
      await cloneRepository(url, fullPath)
      await openFolderWindow(fullPath)
      onOpenChange(false)
      resetForm()
    } catch (err) {
      const resolvedError = resolveCloneError(err)
      setError({
        message: t(resolvedError.key),
        detail: resolvedError.detail ?? null,
      })
      toast.error(t("toasts.cloneFailed"), {
        description: resolvedError.detail ?? t(resolvedError.key),
      })
    } finally {
      disposeTauriListener(unlisten, "CloneDialog.gitCloneProgress")
      setCloning(false)
    }
  }

  const resetForm = () => {
    setUrl("")
    setTargetDir("")
    setError(null)
    setProgress({ percent: null, stage: null, message: null })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) resetForm()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cloneDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="repo-url">{t("cloneDialog.repositoryUrl")}</Label>
            <Input
              id="repo-url"
              placeholder={t("cloneDialog.repositoryUrlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={cloning}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-dir">{t("cloneDialog.directory")}</Label>
            <div className="flex gap-2">
              <Input
                id="target-dir"
                placeholder={t("cloneDialog.directoryPlaceholder")}
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                disabled={cloning}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                disabled={cloning}
                title={t("cloneDialog.browseDirectory")}
                aria-label={t("cloneDialog.browseDirectory")}
                type="button"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{error.message}</p>
              {error.detail && (
                <p className="text-xs text-muted-foreground">{error.detail}</p>
              )}
            </div>
          )}

          {cloning && (progress.message || progress.percent != null) ? (
            <div className="space-y-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress.percent ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{progress.message ?? ""}</span>
                {progress.percent != null ? (
                  <span className="ml-2 tabular-nums">{progress.percent}%</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cloning}
            type="button"
          >
            {t("cloneDialog.cancel")}
          </Button>
          <Button
            onClick={handleClone}
            disabled={!url || !targetDir || cloning}
            type="button"
          >
            {cloning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("cloneDialog.clone")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
