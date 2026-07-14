/**
 * Hibernate state store — tracks whether hibernate mode is active and its type.
 *
 * FUTUREWORK: This store holds state only. The Python version has full runtime
 * scheduling with 6 activity types (Original, Spaced, Glitch, Ramp, Pump-Scare,
 * Chaos), timer-based sleep/wake cycles, wallpaper reset on hibernate end, and
 * a tray "Skip to Hibernate" button. None of that runtime logic is implemented
 * yet. See:
 *   - edgeware/src/features/hibernate.py (main_hibernate, activity_loop, reset_wallpaper)
 *   - FEATURE_PARITY_AUDIT.md §2.2 for the full gap list.
 */

import { create } from 'zustand'

export interface HibernateState {
  active: boolean
  timerId: number | null
  type: 'Original' | 'Spaced' | 'Glitch' | 'Ramp' | 'Pump-Scare' | 'Chaos'
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
