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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
