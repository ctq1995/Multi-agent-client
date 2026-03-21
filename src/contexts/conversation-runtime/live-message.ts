import type { LiveMessage } from "@/contexts/acp-connections-context"
import type { MessageTurn } from "@/lib/types"
import { inferLiveToolName } from "@/lib/tool-call-normalization"

type LiveContentBlock = LiveMessage["content"][number]
type ToolCallLiveBlock = Extract<LiveContentBlock, { type: "tool_call" }>

function formatLivePlanEntries(
  entries: Array<{ content: string; priority: string; status: string }>
): string {
  if (entries.length === 0) {
    return "Plan updated."
  }

  const lines = entries.map(
    (entry) => `- [${entry.status}] ${entry.content} (${entry.priority})`
  )
  return `Plan updated:\n${lines.join("\n")}`
}

function appendTextBlock(params: {
  blocks: MessageTurn["blocks"]
  kind: "text" | "thinking"
  text: string
}): void {
  if (params.text.length === 0) {
    return
  }

  params.blocks.push({
    type: params.kind,
    text: params.text,
  })
}

function appendToolCallBlocks(params: {
  blocks: MessageTurn["blocks"]
  block: ToolCallLiveBlock
}): void {
  const { block, blocks } = params
  const toolName = inferLiveToolName({
    title: block.info.title,
    kind: block.info.kind,
    rawInput: block.info.raw_input,
  })

  blocks.push({
    type: "tool_use",
    tool_use_id: block.info.tool_call_id,
    tool_name: toolName,
    input_preview: block.info.raw_input,
  })

  const isFinalState =
    block.info.status === "completed" || block.info.status === "failed"
  if (!isFinalState) {
    return
  }

  blocks.push({
    type: "tool_result",
    tool_use_id: block.info.tool_call_id,
    output_preview: block.info.raw_output ?? block.info.content,
    is_error: block.info.status === "failed",
  })
}

function appendLiveBlock(params: {
  block: LiveContentBlock
  blocks: MessageTurn["blocks"]
}): void {
  const { block, blocks } = params

  switch (block.type) {
    case "text":
      appendTextBlock({ blocks, kind: "text", text: block.text })
      return
    case "thinking":
      appendTextBlock({ blocks, kind: "thinking", text: block.text })
      return
    case "plan":
      appendTextBlock({
        blocks,
        kind: "thinking",
        text: formatLivePlanEntries(block.entries),
      })
      return
    case "tool_call":
      appendToolCallBlocks({ blocks, block })
      return
  }
}

export function buildStreamingTurnFromLiveMessage(
  conversationId: number,
  liveMessage: LiveMessage
): MessageTurn | null {
  const blocks: MessageTurn["blocks"] = []

  for (const block of liveMessage.content) {
    appendLiveBlock({ block, blocks })
  }

  if (blocks.length === 0) {
    return null
  }

  return {
    id: `live-${conversationId}-${liveMessage.id}`,
    role: "assistant",
    blocks,
    timestamp: new Date(liveMessage.startedAt).toISOString(),
  }
}
