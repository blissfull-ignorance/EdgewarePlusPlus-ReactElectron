/**
 * @file popupOverlayStore — In-app popup overlay state.
 *
 * Tracks popups rendered inside the main window (popupRenderMode "inapp").
 * Ephemeral by design: reloads and stops clear the overlay, and there is
 * deliberately no persist middleware so popups never survive navigation.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// "caption" is the in-app text popup (legacy capPop* settings); "subliminal"
// stays in the union for persisted data but is unreachable from dispatch.
export type InAppPopupType = "image" | "video" | "audio" | "prompt" | "caption" | "subliminal";

export interface InAppPopupPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InAppPopup {
  id: string;
  type: InAppPopupType;
  mediaId: string;
  /** Optional spiral GIF to overlay on top of an image/video pop. */
  hypnoGif?: string;
  position: InAppPopupPosition;
}

export interface PopupOverlayState {
  popups: InAppPopup[];
  addPopup: (popup: { type: InAppPopupType; mediaId: string; hypnoGif?: string }) => string;
  removePopup: (id: string) => void;
  clearAll: () => void;
}

function randomPosition(width: number, height: number): InAppPopupPosition {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.floor(Math.random() * Math.max(0, vw - width)),
    y: Math.floor(Math.random() * Math.max(0, vh - height)),
    width,
    height,
  };
}

let popupCounter = 0;

export const usePopupOverlayStore = create<PopupOverlayState>()(
  devtools(
    (set) => ({
      popups: [],
      addPopup: ({ type, mediaId, hypnoGif }) => {
        popupCounter += 1;
        const id = `popup-${Date.now()}-${popupCounter}`;
        const width = 300 + Math.floor(Math.random() * 200);
        const height = 200 + Math.floor(Math.random() * 200);
        const popup: InAppPopup = {
          id,
          type,
          mediaId,
          hypnoGif,
          position: randomPosition(width, height),
        };
        set((s) => ({ popups: [...s.popups, popup] }));
        return id;
      },
      removePopup: (id) => set((s) => ({ popups: s.popups.filter((p) => p.id !== id) })),
      clearAll: () => set({ popups: [] }),
    }),
    { name: "PopupOverlayStore" }
  )
);
