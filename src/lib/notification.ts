import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"

async function shouldNotifyTurnComplete(): Promise<boolean> {
  if (document.hidden) {
    return true
  }

  return !(await getCurrentWindow().isFocused())
}

export async function notifyTurnComplete(
  title: string,
  body: string
): Promise<void> {
  if (!(await shouldNotifyTurnComplete())) return
  await invoke("send_notification", { title, body })
}
