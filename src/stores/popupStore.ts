/**
 * Popup store — tracks all active popup windows.
 *
 * Each popup is represented by an ActivePopup entry with position, size,
 * and movement vector. The store is read by the movement tick loop and
 * updated by both spawn and movement effects.
 *
 * DISCUSSION: popupCount is maintained as a separate counter for performance
 * (avoids computing popups.length on every render). It could drift from
 * popups.length if addPopup/removePopup are called in unexpected order.
 * Consider deriving popupCount from popups.length instead.
 */

import { create } from 'zustand'

export interface ActivePopup {
  id: number
  type: 'image' | 'video' | 'audio'
  mediaPath?: string
  x: number
  y: number
  width: number
  height: number
  /** Whether this popup is currently moving (set once at spawn). */
  moving: boolean
  /** Directional vector X (unit length, may be negative). Reversed on bounce. */
  dx: number
  /** Directional vector Y (unit length, may be negative). Reversed on bounce. */
  dy: number
}

export interface PopupState {
  popups: ActivePopup[]
  popupCount: number
  addPopup: (popup: ActivePopup) => void
  removePopup: (id: number) => void
  updatePopup: (id: number, update: Partial<Pick<ActivePopup, 'x' | 'y' | 'dx' | 'dy'>>) => void
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
  updatePopup: (id, update) => set((state) => ({
    popups: state.popups.map((p) => p.id === id ? { ...p, ...update } : p),
  })),
  clearPopups: () => set({ popups: [], popupCount: 0 }),
}))
