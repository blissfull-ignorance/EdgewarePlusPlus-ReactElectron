import { create } from 'zustand'
import type { Pack } from '@/types/pack'

export interface PackState {
  pack: Pack | null
  loaded: boolean
  loading: boolean
  error: string | null
  /** Runtime override for close button text (set by Lua scripting API). */
  popupCloseOverride: string | null
  loadPack: (pack: Pack) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  unloadPack: () => void
  setPopupCloseOverride: (text: string) => void
  getPopupCloseText: () => string
  getMedia: (type: 'image' | 'video' | 'audio' | 'hypno') => string[]
  getTexts: (type: 'caption' | 'denial' | 'prompt' | 'subliminal' | 'notification' | 'web') => string[]
}

export const usePackStore = create<PackState>((set, get) => ({
  pack: null,
  loaded: false,
  loading: false,
  error: null,
  popupCloseOverride: null,
  loadPack: (pack) => set({ pack, loaded: true, loading: false, error: null, popupCloseOverride: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  unloadPack: () => set({ pack: null, loaded: false, loading: false, error: null, popupCloseOverride: null }),
  setPopupCloseOverride: (text) => set({ popupCloseOverride: text }),
  getPopupCloseText: () => {
    const state = get()
    return state.popupCloseOverride || state.pack?.popupClose || 'Close'
  },
  getMedia: (type) => {
    const pack = get().pack
    const key = type === 'image' ? 'images' : type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'hypno'
    return pack?.media?.[key] || []
  },
  getTexts: (type) => {
    const pack = get().pack
    const key = type === 'caption' ? 'captions' : type === 'denial' ? 'denials' : type === 'prompt' ? 'prompts' : type === 'subliminal' ? 'subliminals' : type === 'notification' ? 'notifications' : 'web'
    return pack?.texts?.[key] || []
  },
}))
