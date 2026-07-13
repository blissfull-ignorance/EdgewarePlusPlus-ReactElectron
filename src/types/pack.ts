export interface Config {
  delay: number
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
  denialChance: number
  drivePath: string
  maxAudio: number
  maxVideos: number
  subliminalsChance: number
  safeMode: boolean
  toggleInternet: boolean
  buttonless: boolean
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
  movingChance: number
  movingSpeed: number
  capPopChance: number
  capPopOpacity: number
  capPopTimer: number
  subliminalsAlpha: number
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
  clickthroughPopups: boolean
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
  popupScale: number
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

export interface Pack {
  info: PackInfo
  index: PackIndex
  corruption: CorruptionConfig
  media: {
    images: string[]
    videos: string[]
    audio: string[]
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
