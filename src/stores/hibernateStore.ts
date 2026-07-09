import { create } from 'zustand'

export interface HibernateState {
  active: boolean
  timerId: number | null
  type: 'Original' | 'Spaced' | 'Glitch' | 'Ramp' | 'PumpScare' | 'Chaos'
  activate: (type: HibernateState['type']) => void
  deactivate: () => void
}

export const useHibernateStore = create<HibernateState>((set) => ({
  active: false,
  timerId: null,
  type: 'Original',
  activate: (type) => set({ active: true, type }),
  deactivate: () => set({ active: false, type: 'Original' }),
}))
