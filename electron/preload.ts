import { contextBridge, ipcRenderer } from 'electron'
import type { Config, PopupOptions } from './types.js'

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: (): Promise<Config> => ipcRenderer.invoke('config:load'),
  saveConfig: (config: Config): Promise<void> => ipcRenderer.invoke('config:save', config),

  onKeyEvent: (cb: (type: string, key: string) => void) => {
    ipcRenderer.on('keyboard:event', (_event, type, key) => cb(type, key))
  },

  setWallpaper: (path: string): Promise<void> => ipcRenderer.invoke('wallpaper:set', path),
  getWallpaper: (): Promise<string> => ipcRenderer.invoke('wallpaper:get'),

  onTrayAction: (cb: (action: string) => void) => {
    ipcRenderer.on('tray:action', (_event, action) => cb(action))
  },

  createPopup: (opts: PopupOptions): Promise<number> => ipcRenderer.invoke('popup:create', opts),
  closePopup: (id: number): Promise<void> => ipcRenderer.invoke('popup:close', id),
  movePopup: (id: number, x: number, y: number): Promise<void> => ipcRenderer.invoke('popup:move', id, x, y),
  setPopupClickthrough: (id: number, enabled: boolean): Promise<void> => ipcRenderer.invoke('popup:clickthrough', id, enabled),

  createShortcut: (name: string, target: string, icon: string): Promise<void> => ipcRenderer.invoke('shortcut:create', name, target, icon),

  fillDrive: (path: string, size: number): Promise<void> => ipcRenderer.invoke('drive:fill', path, size),
  replaceImages: (path: string, count: number): Promise<void> => ipcRenderer.invoke('drive:replace', path, count),

  sendPanic: (): Promise<void> => ipcRenderer.invoke('panic:trigger'),
  onPanic: (cb: () => void) => { ipcRenderer.on('panic', () => cb()) },

  onHibernateTimer: (cb: () => void) => { ipcRenderer.on('hibernate:timer', () => cb()) },

  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),

  loadPack: (packDir: string): Promise<unknown> => ipcRenderer.invoke('pack:load', packDir),
})
