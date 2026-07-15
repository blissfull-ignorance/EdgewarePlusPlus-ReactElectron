/**
 * Config store — holds all user-configurable settings.
 *
 * Defaults are defined in the `defaults` object. On startup, Electron loads
 * the persisted config from disk and calls updateConfig() to merge saved values
 * over the defaults. Only non-default values are persisted to disk.
 *
 * Key popup-related settings:
 *   - delay: spawn interval in ms
 *   - maxImages: max concurrent image popups
 *   - maxVideos: max concurrent video popups
 *   - maxAudio: max concurrent audio popups
 *   - popupScale: multiplier for popup dimensions (0.5x–3x)
 *   - movingChance: probability (0–100) that a popup spawns with movement
 *   - movingSpeed: pixels per tick (50ms) for moving popups
 *   - subliminalsChance: probability that a static image gets a hypno overlay
 *   - subliminalsAlpha: opacity for hypno overlay (0–100, mapped to 0.0–1.0)
 *   - denialChance: probability that a popup gets a visual denial filter
 *   - buttonless: if true, clicksToClose = 999 (clicks don't dismiss)
 *   - clickthroughPopups: if true, popups are click-through (transparent to input)
 *
 * FUTUREWORK: Consider splitting this monolithic config into sub-stores
 * (popupConfig, corruptionConfig, scheduleConfig) to reduce re-render scope
 * when unrelated settings change.
 */

import { create } from 'zustand'
import type { Config } from '@/types/pack'

const defaults: Config = {
  delay: 5000,
  fill: false,
  replace: false,
  webMod: 0,
  popupMod: 100,
  audioMod: 0,
  promptMod: 0,
  vidMod: 10,
  replaceThresh: 500,
  fill_delay: 0,
  start_on_logon: false,
  hibernateMode: false,
  hibernateMin: 240,
  hibernateMax: 300,
  wakeupActivity: 20,
  showDiscord: false,
  showLoadingFlair: true,
  showCaptions: false,
  panicButton: 'e',
  panicDisabled: false,
  promptMistakes: 3,
  mitosisMode: false,
  mitosisChance: 50,
  webPopup: false,
  rotateWallpaper: false,
  wallpaperTimer: 30,
  wallpaperVariance: 0,
  timeoutPopups: false,
  popupTimeout: 1,
  mitosisStrength: 2,
  avoidList: 'edgeware>AppData',
  booruName: '',
  booruMinScore: -5,
  desktopIcons: true,
  tagList: 'all',
  downloadEnabled: false,
  runOnSaveQuit: false,
  timerMode: false,
  timerSetupTime: 1,
  safeword: 'password',
  lkCorner: 0,
  lkScaling: 100,
  lkToggle: false,
  videoVolume: 25,
  denialChance: 0,
  drivePath: '',
  maxAudio: 1,
  maxImages: 10,
  maxVideos: 10,
  subliminalsChance: 0,
  safeMode: true,
  toggleInternet: false,
  buttonless: false,
  hibernateType: 'Original',
  hibernateLength: 15,
  fixWallpaper: false,
  toggleHibSkip: false,
  toggleMoodSet: false,
  corruptionMode: false,
  corruptionTime: 60,
  corruptionFadeType: 'Normal',
  singleMode: false,
  multiClick: false,
  themeType: 'Original',
  themeNoConfig: false,
  presetsDanger: false,
  corruptionTrigger: 'Timed',
  corruptionPopups: 5,
  corruptionLaunches: 2,
  corruptionDevMode: false,
  corruptionWallpaperCycle: false,
  corruptionThemeCycle: false,
  corruptionPurityMode: false,
  corruptionFullPerm: true,
  movingChance: 0,
  movingSpeed: 5,
  capPopChance: 0,
  capPopOpacity: 100,
  capPopTimer: 1,
  subliminalsAlpha: 20,
  messageOff: false,
  notificationChance: 0,
  notificationImageChance: 50,
  packPath: '',
  globalPanicButton: 'Key.esc',
  videoHardwareAcceleration: true,
  wallpaperDat: "{'default': 'wallpaper.png'}",
  disabledMonitors: [],
  mpvSubprocess: true,
  audioVolume: 100,
  clickthroughPopups: false,
  fadeInDuration: 0,
  fadeOutDuration: 0,
  schedule: false,
  scheduleType: 'Relative',
  timeType: 'Hours',
  scheduleTime: 1,
  varianceTime: 0,
  varianceType: 'Hours',
  repeatSchedule: false,
  repeatType: 'Hours',
  repeatTime: 0,
  popupScale: 1,
}

export interface ConfigState extends Config {
  updateConfig: (partial: Partial<Config>) => void
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  ...defaults,
  updateConfig: (partial) => {
    const merged = { ...get(), ...partial }
    if (partial.hibernateMode === false && merged.fixWallpaper) {
      merged.fixWallpaper = false
    }
    set(merged)
  },
}))
