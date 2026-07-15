import { create } from 'zustand'
import { usePopupStore } from './popupStore'
import { useCorruptionStore } from './corruptionStore'
import { useMoodStore } from './moodStore'
import { useAppStore } from './appStore'
import { usePromptStore } from './promptStore'
import { usePackStore } from './packStore'

export interface ScriptState {
  running: boolean
  lastError: string | null
  setRunning: (running: boolean) => void
  setError: (error: string | null) => void
}

export const useScriptStore = create<ScriptState>((set) => ({
  running: false,
  lastError: null,
  setRunning: (running) => set({ running, lastError: null }),
  setError: (error) => set({ lastError: error, running: false }),
}))

let listenersAttached = false

export function attachScriptListeners(): void {
  if (listenersAttached) return
  listenersAttached = true

  const api = window.electronAPI
  if (!api) return

  api.onScriptStatus((status) => {
    useScriptStore.getState().setRunning(status.running)
    if (status.error) {
      useScriptStore.getState().setError(status.error)
    }
  })

  api.onScriptSpawnPopup((info) => {
    if (info.type === 'audio') {
      usePopupStore.getState().addPopup({
        id: info.id,
        type: 'audio',
        mediaPath: info.filename,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        moving: false,
        dx: 0,
        dy: 0,
        spawnTime: 0, mitosisSpawned: false,
      })
    } else {
      usePopupStore.getState().addPopup({
        id: info.id,
        type: info.type as 'image' | 'video',
        mediaPath: info.filename,
        x: Math.round(Math.random() * (window.screen?.availWidth ?? 1920) / 2),
        y: Math.round(Math.random() * (window.screen?.availHeight ?? 1080) / 2),
        width: 400,
        height: 300,
        moving: false,
        dx: 0,
        dy: 0,
        spawnTime: 0, mitosisSpawned: false,
      })
    }
  })

  api.onScriptPrompt((info) => {
    usePromptStore.getState().activate(info.text, 3, 5, 100, () => {})
  })

  api.onScriptCorruptionProgress(() => {
    useCorruptionStore.getState().advanceLevel()
  })

  api.onScriptSetWallpaper((info) => {
    api.setWallpaper(info.filename)
  })

  api.onScriptPanic(() => {
    useAppStore.getState().triggerPanic()
    api.sendPanic()
  })

  api.onScriptClosePopups(() => {
    usePopupStore.getState().clearPopups()
  })

  api.onScriptSetMoods((info) => {
    useMoodStore.getState().setActiveMoods(info.moods)
  })

  api.onScriptEnableMood((info) => {
    useMoodStore.getState().addMood(info.mood)
  })

  api.onScriptDisableMood((info) => {
    useMoodStore.getState().removeMood(info.mood)
  })

  api.onScriptOpenWeb((info) => {
    if (info.url) {
      window.open(info.url, '_blank')
    }
  })

  // DISCUSSION: set_popup_close_text is a Lua scripting API that overrides the
  // close button text at runtime. The override persists until pack change or unload.
  api.onScriptSetPopupCloseText((info) => {
    if (info.text) {
      usePackStore.getState().setPopupCloseOverride(info.text)
    }
  })
}
