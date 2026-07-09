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
