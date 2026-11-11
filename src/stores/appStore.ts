import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ─── App Store ────────────────────────────────────────────────────────────────
// Global application state: pack path, theme, running state, derived state.

export type ThemeType = "Original" | "Dark" | "The One" | "Ransom" | "Goth" | "Bimbo";

export interface AppState {
  packPath: string | null;
  themeType: ThemeType;
  isRunning: boolean;
  popupsCount: number;
  hibernateActive: boolean;

  setPackPath: (path: string | null) => void;
  setTheme: (theme: ThemeType) => void;
  start: () => void;
  stop: () => void;
  incrementPopups: () => void;
  decrementPopups: () => void;
  setHibernateActive: (active: boolean) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        packPath: null,
        themeType: "Original",
        isRunning: false,
        popupsCount: 0,
        hibernateActive: false,

        setPackPath: (packPath) => set({ packPath }),
        setTheme: (themeType) => set({ themeType }),
        start: () => set({ isRunning: true }),
        stop: () => set({ isRunning: false, popupsCount: 0, hibernateActive: false }),
        incrementPopups: () => set((s) => ({ popupsCount: s.popupsCount + 1 })),
        decrementPopups: () =>
          set((s) => ({ popupsCount: Math.max(0, s.popupsCount - 1) })),
        setHibernateActive: (hibernateActive) => set({ hibernateActive }),
      }),
      {
        name: "edgeware-app",
        // Runtime state is per-session: a boot must never resurrect a
        // running session, its popup count, or hibernate.
        partialize: (state) => ({ packPath: state.packPath, themeType: state.themeType }),
      }
    ),
    { name: "AppStore" }
  )
);
