/**
 * Mood state store — tracks available and active moods for corruption mode.
 *
 * DISCUSSION: The Python version derives available moods dynamically from the
 * pack's corruption levels. This store hardcodes a default list. Consider
 * populating availableMoods from the loaded pack's corruption config.
 */

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
