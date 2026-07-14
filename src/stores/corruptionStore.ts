/**
 * Corruption state store — tracks the current corruption level and active moods.
 *
 * FUTUREWORK: This store holds state only. The Python version has full runtime
 * logic for corruption level progression (timed/popup/launch/script triggers),
 * mood management, wallpaper cycling, theme cycling, and config overrides per
 * level. None of that runtime logic is implemented yet. See:
 *   - edgeware/src/features/corruption.py (timed, popup, launch, apply_corruption_level)
 *   - FEATURE_PARITY_AUDIT.md §2.2 for the full gap list.
 */

import { create } from 'zustand'

export interface CorruptionState {
  enabled: boolean
  level: number
  maxLevel: number
  activeMoods: string[]
  advanceLevel: () => void
  setLevel: (level: number) => void
  setActiveMoods: (moods: string[]) => void
  enableMood: (mood: string) => void
  disableMood: (mood: string) => void
}

export const useCorruptionStore = create<CorruptionState>((set) => ({
  enabled: false,
  level: 0,
  maxLevel: 10,
  activeMoods: [],
  advanceLevel: () => set((state) => ({
    level: Math.min(state.maxLevel, state.level + 1),
  })),
  setLevel: (level) => set({ level }),
  setActiveMoods: (moods) => set({ activeMoods: moods }),
  enableMood: (mood) => set((state) => ({
    activeMoods: [...state.activeMoods, mood],
  })),
  disableMood: (mood) => set((state) => ({
    activeMoods: state.activeMoods.filter((m) => m !== mood),
  })),
}))
