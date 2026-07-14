import { create } from 'zustand'
import { useConfigStore } from './configStore'
import { usePopupStore } from './popupStore'
import { usePackStore } from './packStore'

function buildActivity() {
  const popupCount = usePopupStore.getState().popupCount
  const pack = usePackStore.getState().pack
  const { startTime } = useDiscordStore.getState()

  return {
    details: pack ? `Pack: ${pack.info.name}` : 'Edgeware++',
    state: `${popupCount} popup${popupCount !== 1 ? 's' : ''} active`,
    startTimestamp: startTime ?? undefined,
  }
}

export interface DiscordState {
  connected: boolean
  error: string | null
  startTime: number | null
  initPresence: () => Promise<void>
  updatePresence: () => void
  destroyPresence: () => void
}

export const useDiscordStore = create<DiscordState>((set, get) => ({
  connected: false,
  error: null,
  startTime: null,
  initPresence: async () => {
    const cfg = useConfigStore.getState()
    if (!cfg.showDiscord) return
    if (!window.electronAPI) return
    const result = await window.electronAPI.initDiscord()
    if (result.success) {
      set({ connected: true, error: null, startTime: Date.now() })
      window.electronAPI.updateDiscord(buildActivity())
    } else {
      set({ connected: false, error: result.error ?? 'Unknown error' })
    }
  },
  updatePresence: () => {
    if (!get().connected || !window.electronAPI) return
    window.electronAPI.updateDiscord(buildActivity())
  },
  destroyPresence: () => {
    if (!window.electronAPI) return
    window.electronAPI.destroyDiscord()
    set({ connected: false, error: null, startTime: null })
  },
}))
