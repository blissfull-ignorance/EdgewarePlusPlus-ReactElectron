import type { Config } from '@/types/pack'

interface PopupOptions {
  mediaPath: string
  type: 'image' | 'video' | 'audio'
  width: number
  height: number
  x: number
  y: number
  opacity: number
  clickthrough: boolean
  clicksToClose: number
  denialFilter?: string
  hypnoMediaPath?: string
  hypnoOpacity?: number
}

interface ScriptSpawnInfo {
  type: string
  filename?: string
  id: number
}

interface ScriptStatus {
  running: boolean
  error?: string
}

interface ElectronAPI {
  loadConfig: () => Promise<Config>
  saveConfig: (config: Config) => Promise<void>
  onKeyEvent: (cb: (type: string, key: string) => void) => void
  setWallpaper: (path: string) => Promise<void>
  getWallpaper: () => Promise<string>
  onTrayAction: (cb: (action: string) => void) => void
  createPopup: (opts: PopupOptions) => Promise<number>
  closePopup: (id: number) => Promise<void>
  movePopup: (id: number, x: number, y: number) => Promise<void>
  setPopupClickthrough: (id: number, enabled: boolean) => Promise<void>
  createShortcut: (name: string, target: string, icon: string) => Promise<void>
  fillDrive: (path: string, size: number) => Promise<void>
  replaceImages: (path: string, count: number) => Promise<void>
  sendPanic: () => Promise<void>
  onPanic: (cb: () => void) => void
  onPopupClosed: (cb: (id: number) => void) => void
  onHibernateTimer: (cb: () => void) => void
  openDirectory: () => Promise<string | null>
  loadPack: (packDir: string) => Promise<unknown>
  getScreenBounds: () => Promise<{ x: number; y: number; width: number; height: number }>
  startScripting: () => Promise<ScriptStatus>
  stopScripting: () => Promise<void>
  executeScriptFile: (path: string) => Promise<ScriptStatus>
  executeScriptCode: (code: string) => Promise<ScriptStatus>
  getScriptingStatus: () => Promise<{ running: boolean }>
  onScriptStatus: (cb: (status: ScriptStatus) => void) => void
  onScriptSpawnPopup: (cb: (info: ScriptSpawnInfo) => void) => void
  onScriptPrompt: (cb: (info: { text: string }) => void) => void
  onScriptCorruptionProgress: (cb: () => void) => void
  onScriptSetWallpaper: (cb: (info: { filename: string }) => void) => void
  onScriptPanic: (cb: () => void) => void
  onScriptClosePopups: (cb: () => void) => void
  onScriptSetMoods: (cb: (info: { moods: string[] }) => void) => void
  onScriptEnableMood: (cb: (info: { mood: string }) => void) => void
  onScriptDisableMood: (cb: (info: { mood: string }) => void) => void
  onScriptSetPopupCloseText: (cb: (info: { text: string }) => void) => void
  onScriptSetPromptCommandText: (cb: (info: { text: string }) => void) => void
  onScriptSetPromptSubmitText: (cb: (info: { text: string }) => void) => void
  onScriptSetPromptMinLength: (cb: (info: { length: number }) => void) => void
  onScriptSetPromptMaxLength: (cb: (info: { length: number }) => void) => void
  onScriptOpenWeb: (cb: (info: { url: string }) => void) => void
  onScriptOpenSubliminal: (cb: (info: { text: string }) => void) => void
  onScriptNotification: (cb: (info: { text: string }) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
