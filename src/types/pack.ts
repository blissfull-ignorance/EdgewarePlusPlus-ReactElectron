/**
 * Type definitions for the Pack system and configuration.
 *
 * This file defines the shared types used by both the renderer (React) and
 * the main process (Electron IPC). These types are imported by both sides.
 *
 * Key type relationships:
 *   Config → stored in configStore (renderer) and persisted to disk (main)
 *   Pack → loaded by pack.ts (main), stored in packStore (renderer)
 *   Pack.media.hypno → used by spawn tick for overlay selection
 *
 * FUTUREWORK: Many Config fields are legacy from the Python version and are
 * not yet wired to the React UI. Fields like `fill`, `replace`, `webMod`,
 * `audioMod`, etc. are defined here but have no corresponding ConfigPanel
 * controls. Consider pruning unused fields or marking them as deprecated.
 */

export interface Config {
  // --- Spawn timing ---
  /** Spawn interval in milliseconds. */
  delay: number

  // --- Media limits ---
  /** Max concurrent audio popups. */
  maxAudio: number
  /** Max concurrent image popups (static images + gifs). */
  maxImages: number
  /** Max concurrent video popups. */
  maxVideos: number

  // --- Popup appearance ---
  /** Multiplier for popup dimensions (0.5x–3x). */
  popupScale: number
  /** If true, popups ignore mouse clicks (click-through). */
  clickthroughPopups: boolean
  /** If true, clicks don't dismiss popups (clicksToClose = 999). */
  buttonless: boolean

  // --- Movement ---
  /** Probability (0–100) that a spawned popup starts moving. */
  movingChance: number
  /** Pixels per 50ms tick for moving popups. */
  movingSpeed: number

  // --- Hypno / Subliminals ---
  /** Probability (0–100) that a static image gets a gif hypno overlay. */
  subliminalsChance: number
  /** Opacity for hypno overlay (0–100, mapped to CSS opacity 0.0–1.0). */
  subliminalsAlpha: number

  // --- Denial ---
  /** Probability (0–100) that a popup gets a visual denial filter. */
  denialChance: number

  // --- Legacy fields (ported from Python, not all wired to UI yet) ---
  fill: boolean
  replace: boolean
  webMod: number
  popupMod: number
  audioMod: number
  promptMod: number
  vidMod: number
  replaceThresh: number
  fill_delay: number
  start_on_logon: boolean
  hibernateMode: boolean
  hibernateMin: number
  hibernateMax: number
  wakeupActivity: number
  showDiscord: boolean
  showLoadingFlair: boolean
  showCaptions: boolean
  panicButton: string
  panicDisabled: boolean
  promptMistakes: number
  mitosisMode: boolean
  webPopup: boolean
  rotateWallpaper: boolean
  wallpaperTimer: number
  wallpaperVariance: number
  timeoutPopups: boolean
  popupTimeout: number
  mitosisStrength: number
  avoidList: string
  booruName: string
  booruMinScore: number
  desktopIcons: boolean
  tagList: string
  downloadEnabled: boolean
  runOnSaveQuit: boolean
  timerMode: boolean
  timerSetupTime: number
  safeword: string
  lkCorner: number
  lkScaling: number
  lkToggle: boolean
  videoVolume: number
  drivePath: string
  safeMode: boolean
  toggleInternet: boolean
  hibernateType: string
  hibernateLength: number
  fixWallpaper: boolean
  toggleHibSkip: boolean
  toggleMoodSet: boolean
  corruptionMode: boolean
  corruptionTime: number
  corruptionFadeType: string
  singleMode: boolean
  multiClick: boolean
  themeType: string
  themeNoConfig: boolean
  presetsDanger: boolean
  corruptionTrigger: string
  corruptionPopups: number
  corruptionLaunches: number
  corruptionDevMode: boolean
  corruptionWallpaperCycle: boolean
  corruptionThemeCycle: boolean
  corruptionPurityMode: boolean
  corruptionFullPerm: boolean
  capPopChance: number
  capPopOpacity: number
  capPopTimer: number
  messageOff: boolean
  notificationChance: number
  notificationImageChance: number
  packPath: string
  globalPanicButton: string
  videoHardwareAcceleration: boolean
  wallpaperDat: string
  disabledMonitors: string[]
  mpvSubprocess: boolean
  audioVolume: number
  fadeInDuration: number
  fadeOutDuration: number
  schedule: boolean
  scheduleType: string
  timeType: string
  scheduleTime: number
  varianceTime: number
  varianceType: string
  repeatSchedule: boolean
  repeatType: string
  repeatTime: number
}

export interface PackInfo {
  name: string
  version: string
  author: string
  description: string
  icon?: string
}

export interface PackIndex {
  [key: string]: PackAsset[]
}

export interface PackAsset {
  path: string
  mood?: string
  type: 'image' | 'video' | 'audio' | 'hypno' | 'text'
}

export interface CorruptionConfig {
  enabled: boolean
  level: number
  maxLevel: number
  triggers: CorruptionTrigger[]
}

export interface CorruptionTrigger {
  type: 'time' | 'popup_count' | 'launch_count'
  value: number
  action: 'advance' | 'set_level'
}

/**
 * Full pack structure as loaded by the main process and passed to the renderer.
 * Media arrays contain absolute file paths. Hypno contains only .gif files.
 */
export interface Pack {
  info: PackInfo
  index: PackIndex
  corruption: CorruptionConfig
  media: {
    images: string[]
    videos: string[]
    audio: string[]
    /** Only .gif files — used for subliminal overlays on static images. */
    hypno: string[]
  }
  texts: {
    captions: string[]
    denials: string[]
    prompts: string[]
    subliminals: string[]
    notifications: string[]
    web: string[]
  }
  script: string | null
  scriptVersion: 'v0' | 'v1' | null
}
