import { create } from 'zustand'

export interface ActivePopup {
  id: number
  type: 'image' | 'video' | 'audio'
  mediaPath?: string
  x: number
  y: number
  width: number
  height: number
}

export interface PopupState {
  popups: ActivePopup[]
  popupCount: number
  addPopup: (popup: ActivePopup) => void
  removePopup: (id: number) => void
  updatePopupPosition: (id: number, x: number, y: number) => void
  clearPopups: () => void
}

export const usePopupStore = create<PopupState>((set) => ({
  popups: [],
  popupCount: 0,
  addPopup: (popup) => set((state) => ({
    popups: [...state.popups, popup],
    popupCount: state.popupCount + 1,
  })),
  removePopup: (id) => set((state) => ({
    popups: state.popups.filter((p) => p.id !== id),
    popupCount: Math.max(0, state.popupCount - 1),
  })),
  updatePopupPosition: (id, x, y) => set((state) => ({
    popups: state.popups.map((p) => p.id === id ? { ...p, x, y } : p),
  })),
  clearPopups: () => set({ popups: [], popupCount: 0 }),
}))
