import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export interface ConfigData {
  delay: number
  fill: boolean
  replace: boolean
  webMod: number
  popupMod: number
  popupScale: number
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
  maxImages: number
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
}

export function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): ConfigData {
  const configPath = getConfigPath()
  try {
    if (!fs.existsSync(configPath)) {
      return getDefaultConfig()
    }
    const raw = fs.readFileSync(configPath, 'utf-8')
    return { ...getDefaultConfig(), ...JSON.parse(raw) }
  } catch {
    return getDefaultConfig()
  }
}

export function saveConfig(config: ConfigData): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getDefaultConfig(): ConfigData {
  return {
    delay: 5000,
    fill: false,
    replace: false,
    webMod: 0,
    popupMod: 100,
    popupScale: 1,
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
    capPopTimer: 300,
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
  }
}
