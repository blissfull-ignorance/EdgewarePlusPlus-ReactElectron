import { create } from 'zustand'

export interface MoodState {
  availableMoods: string[]
  activeMoods: string[]
  addMood: (mood: string) => void
  removeMood: (mood: string) => void
  setActiveMoods: (moods: string[]) => void
}

export const useMoodStore = create<MoodState>((set) => ({
  availableMoods: ['furry', 'goon', 'hypno', 'scare', 'denial'],
  activeMoods: [],
  addMood: (mood) => set((state) => ({
    activeMoods: [...state.activeMoods, mood],
  })),
  removeMood: (mood) => set((state) => ({
    activeMoods: state.activeMoods.filter((m) => m !== mood),
  })),
  setActiveMoods: (moods) => set({ activeMoods: moods }),
}))
