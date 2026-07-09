import { create } from 'zustand'

export interface ThemeState {
  corruptionLevel: number
  hueRotate: number
  saturate: number
  brightness: number
  blur: number
  variables: Record<string, string>
  setCorruptionLevel: (level: number) => void
  setHueRotate: (degrees: number) => void
  setSaturate: (percent: number) => void
  setBrightness: (percent: number) => void
  setBlur: (px: number) => void
  setVariable: (key: string, value: string) => void
  reset: () => void
}

const defaults = {
  corruptionLevel: 0,
  hueRotate: 0,
  saturate: 100,
  brightness: 100,
  blur: 0,
  variables: {},
}

export const useThemeStore = create<ThemeState>((set) => ({
  ...defaults,
  setCorruptionLevel: (corruptionLevel) => set({ corruptionLevel }),
  setHueRotate: (hueRotate) => set({ hueRotate }),
  setSaturate: (saturate) => set({ saturate }),
  setBrightness: (brightness) => set({ brightness }),
  setBlur: (blur) => set({ blur }),
  setVariable: (key, value) => set((state) => ({
    variables: { ...state.variables, [key]: value },
  })),
  reset: () => set(defaults),
}))
