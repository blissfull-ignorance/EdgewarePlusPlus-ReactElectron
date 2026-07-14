/**
 * App-level state store — splash screen, panic mode, and running state.
 *
 * FUTUREWORK: The Python version tracks additional app-level state in
 * `state.py:State` (fill_number, popup_number, prompt_active, video_number,
 * audio_players, panic_lockout_active, hibernate_active, pump_scare,
 * corruption_level, alt_held). Consider migrating relevant fields here or
 * into dedicated stores as those features are ported.
 */

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
