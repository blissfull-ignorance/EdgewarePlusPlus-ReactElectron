import { Client } from 'discord-rpc'
import type { Presence } from 'discord-rpc'

const CLIENT_ID = '1295322917088737332'
let rpc: Client | null = null
let ready = false

export async function initDiscord(): Promise<{ success: boolean; error?: string }> {
  try {
    if (rpc) {
      destroyDiscord()
    }
    rpc = new Client({ transport: 'ipc' })
    rpc.on('ready', () => { ready = true })
    rpc.on('disconnected', () => { ready = false; rpc = null })
    await rpc.login({ clientId: CLIENT_ID })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    rpc = null
    ready = false
    return { success: false, error: message }
  }
}

export function updateDiscord(activity: Presence): { success: boolean } {
  if (!rpc || !ready) return { success: false }
  try {
    rpc.setActivity(activity)
    return { success: true }
  } catch {
    return { success: false }
  }
}

export function destroyDiscord(): void {
  if (rpc) {
    rpc.clearActivity().catch(() => {})
    rpc.destroy().catch(() => {})
    rpc = null
    ready = false
  }
}
