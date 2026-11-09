import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { logger } from "../utils/logger";
import {
  parseCorruptionData,
  computeActiveMoods,
  computeConfigOverrides,
  getNextLevel,
  type ParsedCorruptionLevel,
} from "../features/corruption/corruptionEngine";

/**
 * Corruption engine (guided mode) state.
 * Tracks current level, active moods, transition timing, and pending actions.
 */

export type CorruptDriver = "timer" | "audio" | "video" | "script";

export interface CorruptionState {
  currentLevel: number;
  activeMoods: string[];
  nextLevelTime: number | null;
  driverType: CorruptDriver;
  transitions: string[];
  levels: Record<number, ParsedCorruptionLevel>;
  corruptionError: string | null;

  loadCorruptionData: (rawData: Record<string, unknown>) => void;
  transitionTo: (level: number) => Record<string, string | number>;
  setDriverType: (driver: CorruptDriver) => void;
  setNextLevelTime: (time: number | null) => void;
  reset: () => void;
}

export const useCorruptionStore = create<CorruptionState>()(
  devtools(
    persist(
      (set, get) => ({
        currentLevel: 0,
        activeMoods: [],
        nextLevelTime: null,
        driverType: "timer",
        transitions: [],
        levels: {},
        corruptionError: null,

        loadCorruptionData: (rawData) => {
          try {
            if (typeof rawData !== "object" || rawData === null) {
              set({ corruptionError: "Corruption data is missing or invalid. Corruption mode will remain at level 0." });
              logger.warn("[corruptionStore] Invalid corruption data received:", rawData);
              return;
            }
            const parsed = parseCorruptionData(rawData);
            if (Object.keys(parsed.levels).length === 0) {
              set({ corruptionError: "No corruption levels found in pack data. Corruption mode will remain at level 0.", levels: {} });
            } else {
              set({ levels: parsed.levels, corruptionError: null });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error loading corruption data";
            set({ corruptionError: `Failed to load corruption data: ${message}. Corruption mode will remain at level 0.` });
            logger.error("[corruptionStore] Error loading corruption data:", err);
          }
        },

        transitionTo: (level) => {
          const state = get();
          const levelData = state.levels[level];
          if (!levelData) {
            set({ currentLevel: level });
            return {};
          }

          const newMoods = computeActiveMoods(state.activeMoods, levelData);
          const configOverrides = computeConfigOverrides(levelData);

          set({
            currentLevel: level,
            activeMoods: newMoods,
            transitions: [...state.transitions, `${state.currentLevel}→${level}`],
          });

          return configOverrides;
        },

        setDriverType: (driverType) => set({ driverType }),

        setNextLevelTime: (nextLevelTime) => set({ nextLevelTime }),

        reset: () =>
          set({
            currentLevel: 0,
            activeMoods: [],
            nextLevelTime: null,
            driverType: "timer",
            transitions: [],
            levels: {},
            corruptionError: null,
          }),
      }),
      {
        name: "edgeware-corruption",
      }
    ),
    { name: "CorruptionStore" }
  )
);

/**
 * Determine the next level number for the current corruption state.
 */
export function getNextCorruptionLevel(): number | null {
  const { currentLevel, levels } = useCorruptionStore.getState();
  return getNextLevel(levels, currentLevel);
}
