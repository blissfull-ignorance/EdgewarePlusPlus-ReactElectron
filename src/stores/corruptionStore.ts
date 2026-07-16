/**
 * Corruption state store — tracks corruption level, progression, moods,
 * config overrides, and trigger state.
 *
 * Pure computation lives in src/features/corruption/corruption.ts.
 * This store manages state and actions that trigger side effects.
 *
 * FUTUREWORK: Add corruption danger check (warns when full-perm mode
 * enables dangerous config keys — see FEATURE_PARITY_AUDIT.md §2.3).
 *
 * FUTUREWORK: Add launch count persistence via Electron IPC (read/write
 * a corruption_launches.dat file in userData).
 */

import { create } from 'zustand'
import type { CorruptionLevelData } from '@/types/pack'
import {
  nextCorruptionLevel,
  resolveActiveMoods,
  computeFadeMoods,
  getConfigOverrides,
  computeCorruptionProgress,
} from '@/features/corruption/corruption'

export type CorruptionTrigger = 'Timed' | 'Popup' | 'Launch' | 'Script'
export type CorruptionFadeType = 'Normal' | 'Abrupt' | 'Glitch' | 'Ramp'

export interface CorruptionState {
  enabled: boolean
  level: number
  maxLevel: number
  activeMoods: string[]
  configOverrides: Record<string, string | number>
  triggerType: CorruptionTrigger
  fadeType: CorruptionFadeType
  corruptionTimeStart: number
  corruptionPopupCount: number
  corruptionLaunchCount: number
  fadeProgress: number
  corruptionLevels: CorruptionLevelData[]
  baseMoods: string[]
  initialized: boolean
  enable: () => void
  disable: () => void
  advanceLevel: () => void
  setLevel: (level: number) => void
  setMaxLevel: (max: number) => void
  setActiveMoods: (moods: string[]) => void
  enableMood: (mood: string) => void
  disableMood: (mood: string) => void
  setTriggerType: (trigger: CorruptionTrigger) => void
  setFadeType: (fade: CorruptionFadeType) => void
  setCorruptionTimeStart: (ts: number) => void
  incrementPopupCount: () => void
  resetPopupCount: () => void
  setCorruptionLevels: (levels: CorruptionLevelData[]) => void
  setBaseMoods: (moods: string[]) => void
  applyLevelEffects: () => void
  computeProgress: (now: number, interval: number, popupThreshold: number, launchThreshold: number) => number
}

export const useCorruptionStore = create<CorruptionState>((set, get) => ({
  enabled: false,
  level: 1,
  maxLevel: 10,
  activeMoods: [],
  configOverrides: {},
  triggerType: 'Timed',
  fadeType: 'Normal',
  corruptionTimeStart: 0,
  corruptionPopupCount: 0,
  corruptionLaunchCount: 1,
  fadeProgress: 0,
  corruptionLevels: [],
  baseMoods: [],
  initialized: false,

  enable: () => set({ enabled: true }),
  disable: () => set({
    enabled: false,
    initialized: false,
    activeMoods: [],
    configOverrides: {},
    fadeProgress: 0,
  }),

  advanceLevel: () => {
    const state = get()
    const newLevel = nextCorruptionLevel(
      state.level,
      state.maxLevel,
      state.triggerType === 'Launch' && false, // purity handled by config
    )
    set({ level: newLevel })
    state.applyLevelEffects()
  },

  setLevel: (level) => set({ level }),

  setMaxLevel: (max) => set({ maxLevel: max }),

  setActiveMoods: (moods) => set({ activeMoods: moods }),

  enableMood: (mood) => set((state) => ({
    activeMoods: [...state.activeMoods, mood],
  })),

  disableMood: (mood) => set((state) => ({
    activeMoods: state.activeMoods.filter((m) => m !== mood),
  })),

  setTriggerType: (trigger) => set({ triggerType: trigger }),

  setFadeType: (fade) => set({ fadeType: fade }),

  setCorruptionTimeStart: (ts) => set({ corruptionTimeStart: ts }),

  incrementPopupCount: () => set((state) => ({
    corruptionPopupCount: state.corruptionPopupCount + 1,
  })),

  resetPopupCount: () => set({ corruptionPopupCount: 0 }),

  setCorruptionLevels: (levels) => set({ corruptionLevels: levels }),

  setBaseMoods: (moods) => set({ baseMoods: moods }),

  applyLevelEffects: () => {
    const state = get()
    if (state.corruptionLevels.length === 0) {
      set({ initialized: true })
      return
    }

    const moods = resolveActiveMoods(
      state.baseMoods,
      state.corruptionLevels,
      state.level,
    )
    const overrides = getConfigOverrides(state.corruptionLevels, state.level)

    // FUTUREWORK: Apply wallpaper via electronAPI.setWallpaper() when
    // corruptionWallpaperCycle is enabled. Currently the wallpaper path
    // is available in corruptionLevels[level - 1].wallpaper but the
    // IPC call needs to be made from App.tsx (side effect).

    set({ activeMoods: moods, configOverrides: overrides, initialized: true })
  },

  computeProgress: (now, interval, popupThreshold, launchThreshold) => {
    const state = get()
    return computeCorruptionProgress(
      state.triggerType,
      now,
      state.corruptionTimeStart,
      interval,
      state.corruptionPopupCount,
      popupThreshold,
      state.corruptionLaunchCount,
      launchThreshold,
      state.level,
    )
  },
}))

/**
 * Returns fade-preview moods by merging next-level moods into current moods.
 *
 * For Normal fade: always returns the merged set. The caller should use
 * this probabilistically (roll based on fadeProgress) to decide whether
 * to actually apply the preview.
 *
 * For Abrupt fade: returns current moods unchanged (no preview).
 */
export function getFadeMoods(
  currentMoods: string[],
  levels: CorruptionLevelData[],
  level: number,
  maxLevel: number,
  fadeType: CorruptionFadeType,
): string[] {
  if (fadeType !== 'Normal') return currentMoods

  const nextLevel = level < maxLevel && levels.length > level
    ? levels[level]
    : null

  return computeFadeMoods(fadeType, currentMoods, nextLevel)
}
