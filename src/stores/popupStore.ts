import { create } from 'zustand'
import type { Popup } from '@/types/popup'

export interface PopupState {
  popups: Popup[]
  popupCount: number
  addPopup: (popup: Omit<Popup, 'id'>) => void
  removePopup: (id: number) => void
  clearPopups: () => void
}

let nextId = 1

export const usePopupStore = create<PopupState>((set) => ({
  popups: [],
  popupCount: 0,
  addPopup: (popup) => {
    const id = nextId++
    set((state) => ({
      popups: [...state.popups, { ...popup, id }],
      popupCount: state.popupCount + 1,
    }))
    return id
  },
  removePopup: (id) => set((state) => ({
    popups: state.popups.filter((p) => p.id !== id),
    popupCount: Math.max(0, state.popupCount - 1),
  })),
  clearPopups: () => set({ popups: [], popupCount: 0 }),
}))
