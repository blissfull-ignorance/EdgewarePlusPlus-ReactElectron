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

  onHibernateSkip: (cb: () => void) => { ipcRenderer.on('hibernate:skip', () => cb()) },

  onPopupClosed: (cb: (id: number) => void) => {
    ipcRenderer.on('popup:closed', (_event, id) => cb(id))
  },

  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),

  loadPack: (packDir: string): Promise<unknown> => ipcRenderer.invoke('pack:load', packDir),

  getScreenBounds: (): Promise<{ x: number; y: number; width: number; height: number }> =>
    ipcRenderer.invoke('screen:bounds'),

  startScripting: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('script:start'),
  stopScripting: (): Promise<void> => ipcRenderer.invoke('script:stop'),
  executeScriptFile: (path: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('script:execute-file', path),
  executeScriptCode: (code: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('script:execute-code', code),
  getScriptingStatus: (): Promise<{ running: boolean }> => ipcRenderer.invoke('script:status'),

  onScriptStatus: (cb: (status: { running: boolean; error?: string }) => void) => {
    ipcRenderer.on('script:status', (_event, status) => cb(status))
  },
  onScriptSpawnPopup: (cb: (info: { type: string; filename?: string; id: number }) => void) => {
    ipcRenderer.on('script:spawn-popup', (_event, info) => cb(info))
  },
  onScriptPrompt: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:prompt', (_event, info) => cb(info))
  },
  onScriptCorruptionProgress: (cb: () => void) => {
    ipcRenderer.on('script:corruption-progress', () => cb())
  },
  onScriptSetWallpaper: (cb: (info: { filename: string }) => void) => {
    ipcRenderer.on('script:set-wallpaper', (_event, info) => cb(info))
  },
  onScriptPanic: (cb: () => void) => {
    ipcRenderer.on('script:panic', () => cb())
  },
  onScriptClosePopups: (cb: () => void) => {
    ipcRenderer.on('script:close-popups', () => cb())
  },
  onScriptSetMoods: (cb: (info: { moods: string[] }) => void) => {
    ipcRenderer.on('script:set-moods', (_event, info) => cb(info))
  },
  onScriptEnableMood: (cb: (info: { mood: string }) => void) => {
    ipcRenderer.on('script:enable-mood', (_event, info) => cb(info))
  },
  onScriptDisableMood: (cb: (info: { mood: string }) => void) => {
    ipcRenderer.on('script:disable-mood', (_event, info) => cb(info))
  },
  onScriptSetPopupCloseText: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:set-popup-close-text', (_event, info) => cb(info))
  },
  onScriptSetPromptCommandText: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:set-prompt-command-text', (_event, info) => cb(info))
  },
  onScriptSetPromptSubmitText: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:set-prompt-submit-text', (_event, info) => cb(info))
  },
  onScriptSetPromptMinLength: (cb: (info: { length: number }) => void) => {
    ipcRenderer.on('script:set-prompt-min-length', (_event, info) => cb(info))
  },
  onScriptSetPromptMaxLength: (cb: (info: { length: number }) => void) => {
    ipcRenderer.on('script:set-prompt-max-length', (_event, info) => cb(info))
  },
  onScriptOpenWeb: (cb: (info: { url: string }) => void) => {
    ipcRenderer.on('script:open-web', (_event, info) => cb(info))
  },
  onScriptOpenSubliminal: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:open-subliminal', (_event, info) => cb(info))
  },
  onScriptNotification: (cb: (info: { text: string }) => void) => {
    ipcRenderer.on('script:notification', (_event, info) => cb(info))
  },

  showNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notification:show', title, body),

  initDiscord: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('discord:init'),
  updateDiscord: (activity: Record<string, unknown>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('discord:update', activity),
  destroyDiscord: (): Promise<void> =>
    ipcRenderer.invoke('discord:destroy'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('web:openExternal', url),
})
