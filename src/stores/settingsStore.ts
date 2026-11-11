import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { logger } from "../utils/logger";
import { validateSettings, type ValidationIssue } from "../utils/zodValidation";

/**
 * Settings store — persists all config keys to JSON via IPC.
 * Load/save use the renderer's IPC bridge; persistence middleware
 * handles local storage fallback in development.
 */

export type SettingsValues = {
  packPath?: string | null;
  packFolders: string[];
  themeType: string;
  themeNoConfig: number;
  showLoadingFlair: number;
  runOnSaveQuit: number;
  desktopIcons: number;
  safeMode: number;
  messageOff: number;
  presetsDanger: number;
  globalPanicButton: string;
  popupMod: number;
  audioMod: number;
  maxAudio: number;
  audioVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  vidMod: number;
  maxVideos: number;
  videoVolume: number;
  videoLoopInf: number;
  videoLoopCount: number;
  webMod: number;
  webPopup: number;
  promptMod: number;
  promptMistakes: number;
  capPopChance: number;
  capPopTimer: number;
  capPopOpacity: number;
  notificationChance: number;
  notificationImageChance: number;
  delay: number;
  singleMode: number;
  showCaptions: number;
  subliminalsChance: number;
  subliminalsAlpha: number;
  denialChance: number;
  buttonless: number;
  multiClick: number;
  lkScaling: number;
  timeoutPopups: number;
  popupTimeout: number;
  disabledMonitors: string;
  movingChance: number;
  movingSpeed: number;
  clickthroughPopups: number;
  rotateWallpaper: number;
  wallpaperDat: string;
  wallpaperTimer: number;
  wallpaperVariance: number;
  downloadEnabled: number;
  tagList: string;
  timerMode: number;
  safeword: string;
  timerSetupTime: number;
  avoidList: string;
  fill: number;
  fillDelay: number;
  replace: number;
  replaceThresh: number;
  drivePath: string;
  panicDisabled: number;
  startOnLogon: number;
  showDiscord: number;
  lkToggle: number;
  lkCorner: number;
  mitosisMode: number;
  mitosisStrength: number;
  hibernateMode: number;
  hibernateType: string;
  hibernateMin: number;
  hibernateMax: number;
  wakeupActivity: number;
  hibernateLength: number;
  fixWallpaper: number;
  corruptionMode: number;
  corruptionFullPerm: number;
  corruptionTrigger: string;
  corruptionFadeType: string;
  corruptionTime: number;
  corruptionPopups: number;
  corruptionLaunches: number;
  corruptionWallpaperCycle: number;
  corruptionThemeCycle: number;
  corruptionPurityMode: number;
  corruptionDevMode: number;
  toggleHibSkip: number;
  toggleMoodSet: number;
  toggleInternet: number;
  mpvSubprocess: number;
  videoHardwareAcceleration: number;
  panicButton: string;
  schedule: number;
  timeType: string;
  scheduleTime: number;
  varianceTime: number;
  varianceType: string;
  repeatSchedule: number;
  repeatType: string;
  repeatTime: number;
  popupRenderMode: "electron" | "inapp";
  [key: string]: unknown;
} & { [key in never]: never };

export const DEFAULT_SETTINGS: SettingsValues = {
  packFolders: [],
  themeType: "Original",
  themeNoConfig: 0,
  showLoadingFlair: 1,
  runOnSaveQuit: 0,
  desktopIcons: 1,
  safeMode: 1,
  messageOff: 0,
  presetsDanger: 0,
  globalPanicButton: "Key.esc",
  popupMod: 100,
  audioMod: 0,
  maxAudio: 1,
  audioVolume: 100,
  fadeInDuration: 0,
  fadeOutDuration: 0,
  vidMod: 10,
  maxVideos: 10,
  videoVolume: 25,
  videoLoopInf: 1,
  videoLoopCount: 1,
  webMod: 0,
  webPopup: 0,
  promptMod: 0,
  promptMistakes: 3,
  capPopChance: 0,
  capPopTimer: 300,
  capPopOpacity: 100,
  notificationChance: 0,
  notificationImageChance: 50,
  delay: 5000,
  singleMode: 0,
  showCaptions: 0,
  subliminalsChance: 0,
  subliminalsAlpha: 20,
  denialChance: 0,
  buttonless: 0,
  multiClick: 0,
  lkScaling: 100,
  timeoutPopups: 0,
  popupTimeout: 1,
  disabledMonitors: "[]",
  movingChance: 0,
  movingSpeed: 5,
  clickthroughPopups: 0,
  rotateWallpaper: 0,
  wallpaperDat: "{}",
  // Stored in seconds, matching the legacy config.json format; convert on read.
  wallpaperTimer: 30,
  wallpaperVariance: 0,
  downloadEnabled: 0,
  tagList: "all",
  timerMode: 0,
  safeword: "password",
  timerSetupTime: 1,
  avoidList: "edgeware>AppData",
  fill: 0,
  fillDelay: 0,
  replace: 0,
  replaceThresh: 500,
  drivePath: "",
  panicDisabled: 0,
  startOnLogon: 0,
  showDiscord: 0,
  lkToggle: 0,
  lkCorner: 0,
  mitosisMode: 0,
  mitosisStrength: 2,
  hibernateMode: 0,
  hibernateType: "Original",
  hibernateMin: 240000,
  hibernateMax: 300000,
  wakeupActivity: 20,
  hibernateLength: 15000,
  fixWallpaper: 0,
  corruptionMode: 0,
  corruptionFullPerm: 1,
  corruptionTrigger: "Timed",
  corruptionFadeType: "Normal",
  // Stored in seconds, matching the legacy config format; currently dormant —
  // consumers should interpret the value as seconds.
  corruptionTime: 60000,
  corruptionPopups: 5,
  corruptionLaunches: 2,
  corruptionWallpaperCycle: 0,
  corruptionThemeCycle: 0,
  corruptionPurityMode: 0,
  corruptionDevMode: 0,
  toggleHibSkip: 0,
  toggleMoodSet: 0,
  toggleInternet: 0,
  mpvSubprocess: 1,
  videoHardwareAcceleration: 1,
  panicButton: "Key.esc",
  schedule: 0,
  timeType: "Minutes",
  scheduleTime: 0,
  varianceTime: 0,
  varianceType: "Minutes",
  repeatSchedule: 0,
  repeatType: "Minutes",
  repeatTime: 0,
  popupRenderMode: "electron",
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type { ValidationIssue };

/**
 * Settings store — persists all config keys to JSON via IPC.
 */
export interface SettingsStore {
  // State
  packPath?: string | null;
  packFolders: string[];
  themeType: string;
  themeNoConfig: number;
  showLoadingFlair: number;
  runOnSaveQuit: number;
  desktopIcons: number;
  safeMode: number;
  messageOff: number;
  presetsDanger: number;
  globalPanicButton: string;
  popupMod: number;
  audioMod: number;
  maxAudio: number;
  audioVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  vidMod: number;
  maxVideos: number;
  videoVolume: number;
  videoLoopInf: number;
  videoLoopCount: number;
  webMod: number;
  webPopup: number;
  promptMod: number;
  promptMistakes: number;
  capPopChance: number;
  capPopTimer: number;
  capPopOpacity: number;
  notificationChance: number;
  notificationImageChance: number;
  delay: number;
  singleMode: number;
  showCaptions: number;
  subliminalsChance: number;
  subliminalsAlpha: number;
  denialChance: number;
  buttonless: number;
  multiClick: number;
  lkScaling: number;
  timeoutPopups: number;
  popupTimeout: number;
  disabledMonitors: string;
  movingChance: number;
  movingSpeed: number;
  clickthroughPopups: number;
  rotateWallpaper: number;
  wallpaperDat: string;
  wallpaperTimer: number;
  wallpaperVariance: number;
  downloadEnabled: number;
  tagList: string;
  timerMode: number;
  safeword: string;
  timerSetupTime: number;
  avoidList: string;
  fill: number;
  fillDelay: number;
  replace: number;
  replaceThresh: number;
  drivePath: string;
  panicDisabled: number;
  startOnLogon: number;
  showDiscord: number;
  lkToggle: number;
  lkCorner: number;
  mitosisMode: number;
  mitosisStrength: number;
  hibernateMode: number;
  hibernateType: string;
  hibernateMin: number;
  hibernateMax: number;
  wakeupActivity: number;
  hibernateLength: number;
  fixWallpaper: number;
  corruptionMode: number;
  corruptionFullPerm: number;
  corruptionTrigger: string;
  corruptionFadeType: string;
  corruptionTime: number;
  corruptionPopups: number;
  corruptionLaunches: number;
  corruptionWallpaperCycle: number;
  corruptionThemeCycle: number;
  corruptionPurityMode: number;
  corruptionDevMode: number;
  toggleHibSkip: number;
  toggleMoodSet: number;
  toggleInternet: number;
  mpvSubprocess: number;
  videoHardwareAcceleration: number;
  panicButton: string;
  schedule: number;
  timeType: string;
  scheduleTime: number;
  varianceTime: number;
  varianceType: string;
  repeatSchedule: number;
  repeatType: string;
  repeatTime: number;
  popupRenderMode: "electron" | "inapp";
  // Save status
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  // True when settings changed since the last successful save
  dirty: boolean;
  // Validation errors from Zod schema validation
  validationErrors: ValidationIssue[];
  // Methods
  load: () => Promise<SettingsValues>;
  /** True once the on-disk settings have been read into the store. */
  loaded: boolean;
  save: () => Promise<void>;
  setRaw: (values: Partial<Record<string, unknown>>) => void;
}

/**
 * The persistable settings record: every state value except the store's own
 * machinery. Unknown keys carried in the store (user-added config entries)
 * round-trip untouched; keys that would shadow a store method are dropped so
 * a hostile config can not disable persistence by being named `save`.
 */
export function collectSettingsValues(state: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    const val = (state as Record<string, unknown>)[key];
    if (typeof val === "function") continue;
    if (NON_PERSISTED_KEYS.has(key) || STORE_METHOD_KEYS.has(key)) continue;
    out[key] = val;
  }
  return out;
}

const NON_PERSISTED_KEYS = new Set([
  "saveStatus",
  "saveErrorMessage",
  "dirty",
  "loaded",
  "validationErrors",
]);

/** Store methods a hostile config key must never be able to shadow. */
const STORE_METHOD_KEYS = new Set(["load", "save", "setRaw"]);

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,
        packPath: null,
        packFolders: [],
        globalPanicButton: "Key.esc",
        saveStatus: "idle",
        saveErrorMessage: null,
        dirty: false,
        loaded: false,
        validationErrors: [],

        load: async (): Promise<SettingsValues> => {
          try {
            const loaded = await window.api?.system.loadSettings();
            if (loaded) {
              // One-time migration: the shipped default panic key "e" held
              // the letter hostage system-wide via the global shortcut.
              const migrated = loaded.globalPanicButton === "e" || loaded.panicButton === "e";
              if (loaded.globalPanicButton === "e") loaded.globalPanicButton = "Key.esc";
              if (loaded.panicButton === "e") loaded.panicButton = "Key.esc";
              const validationErrors = validateSettings(loaded);
              if (validationErrors.length > 0) {
                logger.warn("[settingsStore] Validation issues on load:", validationErrors);
              }
              // Disk wins for every key it carries; keys absent fall back to
              // defaults rather than to whatever a previous session left in
              // local storage. Keys that would shadow store machinery are
              // dropped so a config entry cannot disable save/load.
              const clean = collectSettingsValues({ ...DEFAULT_SETTINGS, ...loaded });
              set({ ...clean, validationErrors, dirty: false, loaded: true } as Partial<SettingsStore>);
              if (migrated) {
                // Persist immediately: the main process registers the global
                // panic shortcut from the stored file, not from this store.
                void window.api?.system
                  .saveSettings(clean)
                  .then(() => window.api?.panic.refreshShortcut())
                  .catch(() => undefined);
              }
              return clean as SettingsValues;
            }
            // No file on disk: the disk is the source of truth, so a stale
            // rehydrated store must not masquerade as the user's settings.
            set({ ...DEFAULT_SETTINGS, validationErrors: [], dirty: false, loaded: true } as Partial<SettingsStore>);
            return DEFAULT_SETTINGS;
          } catch (err) {
            logger.warn("[settingsStore] Failed to load settings, using defaults:", err);
            set({ ...DEFAULT_SETTINGS, validationErrors: [], dirty: false, loaded: true } as Partial<SettingsStore>);
            return DEFAULT_SETTINGS;
          }
        },

        save: async (): Promise<void> => {
          const state = useSettingsStore.getState();
          const stateAsRecord = collectSettingsValues(state);
          set({ saveStatus: "saving", saveErrorMessage: null });
          try {
            await window.api?.system.saveSettings(stateAsRecord);
            // The panic hotkey is registered in the main process; re-read it
            // whenever settings land so globalPanicButton changes apply live.
            void window.api?.panic.refreshShortcut().catch(() => undefined);
            set({ saveStatus: "saved", dirty: false });
            // Legacy run_on_save_quit: a pack (or the user) can arm the app to
            // exit as soon as settings land on disk.
            if (stateAsRecord.runOnSaveQuit === 1) {
              void window.api?.system.quit().catch(() => undefined);
            }
            setTimeout(() => {
              const current = useSettingsStore.getState().saveStatus;
              if (current === "saved") {
                set({ saveStatus: "idle" });
              }
            }, 2000);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown save error";
            logger.error("[settingsStore] Failed to save settings:", err);
            set({ saveStatus: "error", saveErrorMessage: message, dirty: true });
          }
        },

        setRaw: (values: Partial<Record<string, unknown>>): void => {
          set({ ...values, dirty: true });
        },
      }),
      {
        name: "edgeware-settings",
        version: 1,
        partialize: (state) => collectSettingsValues(state) as unknown as SettingsStore,
      }
    ),
    { name: "SettingsStore" }
  )
);
