import { create } from 'zustand'

export interface AppState {
  splashComplete: boolean
  inPanicMode: boolean
  running: boolean
  showSplash: () => void
  completeSplash: () => void
  triggerPanic: () => void
  clearPanic: () => void
  setRunning: (running: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  splashComplete: false,
  inPanicMode: false,
  running: false,
  showSplash: () => set({ splashComplete: false }),
  completeSplash: () => set({ splashComplete: true }),
  triggerPanic: () => {
    set({ inPanicMode: true })
  },
  clearPanic: () => set({ inPanicMode: false }),
  setRunning: (running) => set({ running }),
}))
