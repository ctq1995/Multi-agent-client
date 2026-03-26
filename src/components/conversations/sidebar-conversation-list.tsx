"use client"

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CheckCheck, ChevronRight, Download, Loader2, Plus } from "lucide-react"
import { useFolderContext } from "@/contexts/folder-context"
import { useTabContext } from "@/contexts/tab-context"
import { useTaskContext } from "@/contexts/task-context"
import {
  importLocalConversations,
  updateConversationTitle,
  updateConversationStatus,
  deleteConversation,
} from "@/lib/tauri"
import {
  AGENT_DISPLAY_ORDER,
  STATUS_COLORS,
  STATUS_ORDER,
  type ConversationStatus,
  type DbConversationSummary,
} from "@/lib/types"
import { SidebarConversationCard } from "./sidebar-conversation-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareByUpdatedAtDesc(
  left: DbConversationSummary,
  right: DbConversationSummary
): number {
  const updatedDiff =
    parseTimestamp(right.updated_at) - parseTimestamp(left.updated_at)
  if (updatedDiff !== 0) return updatedDiff

  const createdDiff =
    parseTimestamp(right.created_at) - parseTimestamp(left.created_at)
  if (createdDiff !== 0) return createdDiff

  return right.id - left.id
}

export interface SidebarConversationListHandle {
  scrollToActive: () => void
  expandAll: () => void
  collapseAll: () => void
}

type SidebarRow =
  | {
      kind: "header"
      key: string
      status: ConversationStatus
      count: number
      isOpen: boolean
    }
  | {
      kind: "conversation"
      key: string
      conversation: DbConversationSummary
      isSelected: boolean
    }

const HEADER_ROW_HEIGHT = 34
const CONVERSATION_ROW_HEIGHT = 70
const SIDEBAR_OVERSCAN = 12

function conversationSelectionKey(
  conversationId: number,
  agentType: string
): string {
  return `${agentType}:${conversationId}`
}

function buildSidebarRows(params: {
  grouped: Map<ConversationStatus, DbConversationSummary[]>
  groupExpanded: Record<ConversationStatus, boolean>
  selectedConversation: { id: number; agentType: string } | null
}): {
  rows: SidebarRow[]
  rowIndexByConversation: Map<string, number>
} {
  const rows: SidebarRow[] = []
  const rowIndexByConversation = new Map<string, number>()

  for (const status of STATUS_ORDER) {
    const items = params.grouped.get(status)
    if (!items || items.length === 0) continue

    rows.push({
      kind: "header",
      key: `header-${status}`,
      status,
      count: items.length,
      isOpen: params.groupExpanded[status],
    })

    if (!params.groupExpanded[status]) {
      continue
    }

    for (const conversation of items) {
      const rowIndex = rows.length
      rowIndexByConversation.set(
        conversationSelectionKey(conversation.id, conversation.agent_type),
        rowIndex
      )
      rows.push({
        kind: "conversation",
        key: `conversation-${conversation.agent_type}-${conversation.id}`,
        conversation,
        isSelected:
          params.selectedConversation?.id === conversation.id &&
          params.selectedConversation?.agentType === conversation.agent_type,
      })
    }
  }

  return { rows, rowIndexByConversation }
}

export function SidebarConversationList({
  ref,
}: {
  ref?: Ref<SidebarConversationListHandle>
}) {
  const t = useTranslations("Folder.sidebar")
  const tStatus = useTranslations("Folder.statusLabels")
  const tCommon = useTranslations("Folder.common")
  const {
    folder,
    conversations,
    loading,
    refreshing,
    error,
    selectedConversation,
    folderId,
    refreshConversations,
  } = useFolderContext()

  const { openTab, closeConversationTab, openNewConversationTab } =
    useTabContext()
  const { addTask, updateTask } = useTaskContext()

  const [importing, setImporting] = useState(false)
  const [completeReviewOpen, setCompleteReviewOpen] = useState(false)
  const [completingReview, setCompletingReview] = useState(false)
  const [groupExpanded, setGroupExpanded] = useState<
    Record<ConversationStatus, boolean>
  >({
    in_progress: true,
    pending_review: true,
    completed: false,
    cancelled: false,
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const measurementCacheRef = useRef(new Map<string, number>())
  const rowIndexByConversationRef = useRef(new Map<string, number>())

  useImperativeHandle(ref, () => ({
    scrollToActive() {
      if (!selectedConversation) return
      const conv = conversations.find(
        (c) =>
          c.id === selectedConversation.id &&
          c.agent_type === selectedConversation.agentType
      )
      if (!conv) return
      const status = conv.status as ConversationStatus
      const key = conversationSelectionKey(
        selectedConversation.id,
        selectedConversation.agentType
      )
      const scrollToConversation = () => {
        const index = rowIndexByConversationRef.current.get(key)
        if (index != null) {
          virtualizer.scrollToIndex(index, {
            align: "center",
            behavior: "smooth",
          })
        }
      }
      if (!groupExpanded[status]) {
        setGroupExpanded((prev) => ({ ...prev, [status]: true }))
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollToConversation)
        })
      } else {
        scrollToConversation()
      }
    },
    expandAll() {
      setGroupExpanded({
        in_progress: true,
        pending_review: true,
        completed: true,
        cancelled: true,
      })
    },
    collapseAll() {
      setGroupExpanded({
        in_progress: false,
        pending_review: false,
        completed: false,
        cancelled: false,
      })
    },
  }))

  const grouped = useMemo(() => {
    const map = new Map<ConversationStatus, DbConversationSummary[]>()
    for (const conv of conversations) {
      const status = conv.status as ConversationStatus
      const list = map.get(status)
      if (list) {
        list.push(conv)
      } else {
        map.set(status, [conv])
      }
    }
    for (const list of map.values()) {
      list.sort(compareByUpdatedAtDesc)
    }
    return map
  }, [conversations])

  const reviewConversations = useMemo(
    () => grouped.get("pending_review") ?? [],
    [grouped]
  )
  const reviewConversationCount = reviewConversations.length
  const { rows, rowIndexByConversation } = useMemo(
    () =>
      buildSidebarRows({
        grouped,
        groupExpanded,
        selectedConversation,
      }),
    [grouped, groupExpanded, selectedConversation]
  )

  useEffect(() => {
    rowIndexByConversationRef.current = rowIndexByConversation
  }, [rowIndexByConversation])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const row = rows[index]
      if (!row) return CONVERSATION_ROW_HEIGHT
      const cached = measurementCacheRef.current.get(row.key)
      if (cached) return cached
      return row.kind === "header" ? HEADER_ROW_HEIGHT : CONVERSATION_ROW_HEIGHT
    },
    overscan: SIDEBAR_OVERSCAN,
    useAnimationFrameWithResizeObserver: true,
    getItemKey: (index) => rows[index]?.key ?? index,
  })

  const toggleGroup = useCallback((status: ConversationStatus) => {
    setGroupExpanded((prev) => ({ ...prev, [status]: !prev[status] }))
  }, [])

  const handleSelect = useCallback(
    (id: number, agentType: string) => {
      openTab(id, agentType as Parameters<typeof openTab>[1], false)
    },
    [openTab]
  )

  const handleDoubleClick = useCallback(
    (id: number, agentType: string) => {
      openTab(id, agentType as Parameters<typeof openTab>[1], true)
    },
    [openTab]
  )

  const handleRename = useCallback(
    async (id: number, newTitle: string) => {
      await updateConversationTitle(id, newTitle)
      refreshConversations()
    },
    [refreshConversations]
  )

  const handleDelete = useCallback(
    async (id: number, agentType: string) => {
      await deleteConversation(id)
      closeConversationTab(id, agentType as Parameters<typeof openTab>[1])
      refreshConversations()
    },
    [closeConversationTab, refreshConversations]
  )

  const handleStatusChange = useCallback(
    async (id: number, status: ConversationStatus) => {
      await updateConversationStatus(id, status)
      refreshConversations()
    },
    [refreshConversations]
  )

  const handleNewConversation = useCallback(() => {
    if (!folder) return
    openNewConversationTab(AGENT_DISPLAY_ORDER[0], folder.path)
  }, [folder, openNewConversationTab])

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    const taskId = `import-${folderId}-${Date.now()}`
    addTask(taskId, t("importLocalSessions"))
    updateTask(taskId, { status: "running" })
    try {
      const result = await importLocalConversations(folderId)
      updateTask(taskId, { status: "completed" })
      refreshConversations()
      if (result.imported > 0) {
        toast.success(
          t("toasts.importedSessions", {
            imported: result.imported,
            skipped: result.skipped,
          })
        )
      } else {
        toast.info(t("toasts.noNewSessionsFound", { skipped: result.skipped }))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateTask(taskId, { status: "failed", error: msg })
      toast.error(t("toasts.importFailed", { message: msg }))
    } finally {
      setImporting(false)
    }
  }, [importing, folderId, addTask, updateTask, refreshConversations, t])

  const handleCompleteAllReview = useCallback(async () => {
    if (completingReview || reviewConversationCount === 0) return
    setCompletingReview(true)
    try {
      await Promise.all(
        reviewConversations.map((conversation) =>
          updateConversationStatus(conversation.id, "completed")
        )
      )
      refreshConversations()
      toast.success(
        t("toasts.reviewCompleted", { count: reviewConversationCount })
      )
      setCompleteReviewOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(t("toasts.completeReviewFailed", { message: msg }))
    } finally {
      setCompletingReview(false)
    }
  }, [
    completingReview,
    reviewConversationCount,
    reviewConversations,
    refreshConversations,
    t,
  ])

  const measureRowElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return
      const index = Number(element.dataset.index)
      if (!Number.isFinite(index)) return
      const row = rows[index]
      if (row) {
        measurementCacheRef.current.set(
          row.key,
          element.getBoundingClientRect().height
        )
      }
      virtualizer.measureElement(element)
    },
    [rows, virtualizer]
  )

  const renderHeaderRow = useCallback(
    (row: Extract<SidebarRow, { kind: "header" }>) => {
      const headerButton = (
        <button
          type="button"
          onClick={() => toggleGroup(row.status)}
          className="flex items-center gap-1.5 w-full px-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              row.isOpen && "rotate-90"
            )}
          />
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              STATUS_COLORS[row.status]
            )}
          />
          <span>{tStatus(row.status)}</span>
          <span className="ml-auto text-muted-foreground/60 tabular-nums">
            {row.count}
          </span>
        </button>
      )

      if (row.status !== "pending_review") {
        return headerButton
      }

      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>{headerButton}</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              disabled={reviewConversationCount === 0 || completingReview}
              onSelect={() => setCompleteReviewOpen(true)}
            >
              <CheckCheck className="h-4 w-4" />
              {t("completeAllSessions")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )
    },
    [completingReview, reviewConversationCount, t, tStatus, toggleGroup]
  )

  const renderVirtualRow = useCallback(
    (virtualItem: VirtualItem) => {
      const row = rows[virtualItem.index]
      if (!row) return null

      return (
        <div
          key={virtualItem.key}
          ref={measureRowElement}
          data-index={virtualItem.index}
          className="absolute left-0 top-0 w-full"
          style={{
            transform: `translate3d(0, ${virtualItem.start}px, 0)`,
          }}
        >
          {row.kind === "header" ? (
            <div className="bg-sidebar">{renderHeaderRow(row)}</div>
          ) : (
            <SidebarConversationCard
              conversation={row.conversation}
              isSelected={row.isSelected}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onRename={handleRename}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onNewConversation={handleNewConversation}
              onImport={handleImport}
              importing={importing}
            />
          )}
        </div>
      )
    },
    [
      handleDelete,
      handleDoubleClick,
      handleImport,
      handleNewConversation,
      handleRename,
      handleSelect,
      handleStatusChange,
      importing,
      measureRowElement,
      renderHeaderRow,
      rows,
    ]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {(loading || refreshing) && (
        <div className="flex items-center justify-center py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}

      {loading && !refreshing ? (
        <div className="px-3 space-y-1.5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-3">
          <p className="text-destructive text-xs">
            {t("error", { message: error })}
          </p>
        </div>
      ) : conversations.length === 0 ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex-1 flex flex-col items-center justify-center px-3 gap-3">
              <p className="text-muted-foreground text-xs text-center">
                {t("noConversationsFound")}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                {importing ? t("importing") : t("importLocalSessions")}
              </Button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={handleNewConversation}>
              <Plus className="h-4 w-4" />
              {t("newConversation")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={importing} onSelect={handleImport}>
              <Download className="h-4 w-4" />
              {importing ? t("importing") : t("importLocalSessions")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollContainerRef}
              className={cn(
                "flex-1 min-h-0 overflow-y-auto px-1.5",
                "[&::-webkit-scrollbar]:w-1.5",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                "[&::-webkit-scrollbar-thumb]:bg-border"
              )}
            >
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map(renderVirtualRow)}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={handleNewConversation}>
              <Plus className="h-4 w-4" />
              {t("newConversation")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={importing} onSelect={handleImport}>
              <Download className="h-4 w-4" />
              {importing ? t("importing") : t("importLocalSessions")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
      <AlertDialog
        open={completeReviewOpen}
        onOpenChange={(open) =>
          !completingReview && setCompleteReviewOpen(open)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("completeAllReviewTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("completeAllReviewDescription", {
                count: reviewConversationCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completingReview}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={completingReview || reviewConversationCount === 0}
              onClick={handleCompleteAllReview}
            >
              {completingReview ? t("completing") : tCommon("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
