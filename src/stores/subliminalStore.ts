import { create } from 'zustand'

export interface ActiveSubliminal {
  id: number
  text: string
  x: number
  y: number
  opacity: number
  duration: number
  spawnTime: number
}

export interface SubliminalState {
  subliminals: ActiveSubliminal[]
  addSubliminal: (subliminal: ActiveSubliminal) => void
  removeSubliminal: (id: number) => void
  clearSubliminals: () => void
}

let subliminalIdCounter = 1

export const useSubliminalStore = create<SubliminalState>((set) => ({
  subliminals: [],
  addSubliminal: (subliminal) => set((state) => ({
    subliminals: [...state.subliminals, subliminal],
  })),
  removeSubliminal: (id) => set((state) => ({
    subliminals: state.subliminals.filter((s) => s.id !== id),
  })),
  clearSubliminals: () => set({ subliminals: [] }),
}))

export function nextSubliminalId(): number {
  return subliminalIdCounter++
}

export function resetSubliminalIdCounter(): void {
  subliminalIdCounter = 1
}
