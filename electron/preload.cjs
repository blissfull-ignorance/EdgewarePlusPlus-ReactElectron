// FIXME: Keep this file in sync with preload.ts — preload.cjs is the file actually loaded by BrowserWindow.
// REMOVABLE: This entire file could be replaced by a build step that transpiles preload.ts to CJS.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  onKeyEvent: (cb) => {
    ipcRenderer.on('keyboard:event', (_event, type, key) => cb(type, key))
  },

  setWallpaper: (path) => ipcRenderer.invoke('wallpaper:set', path),
  getWallpaper: () => ipcRenderer.invoke('wallpaper:get'),

  onTrayAction: (cb) => {
    ipcRenderer.on('tray:action', (_event, action) => cb(action))
  },

  createPopup: (opts) => ipcRenderer.invoke('popup:create', opts),
  closePopup: (id) => ipcRenderer.invoke('popup:close', id),
  movePopup: (id, x, y) => ipcRenderer.invoke('popup:move', id, x, y),
  setPopupClickthrough: (id, enabled) => ipcRenderer.invoke('popup:clickthrough', id, enabled),

  createShortcut: (name, target, icon) => ipcRenderer.invoke('shortcut:create', name, target, icon),

  fillDrive: (path, size) => ipcRenderer.invoke('drive:fill', path, size),
  replaceImages: (path, count) => ipcRenderer.invoke('drive:replace', path, count),

  sendPanic: () => ipcRenderer.invoke('panic:trigger'),
  onPanic: (cb) => { ipcRenderer.on('panic', () => cb()) },

  startLockout: (lockoutMinutes) => ipcRenderer.invoke('panic:startLockout', lockoutMinutes),
  clearLockout: () => ipcRenderer.invoke('panic:clearLockout'),
  validateSafeword: (input) => ipcRenderer.invoke('panic:validateSafeword', input),
  onLockoutStart: (cb) => { ipcRenderer.on('panic:lockout-start', (_event, endTime) => cb(endTime)) },
  onLockoutClear: (cb) => { ipcRenderer.on('panic:lockout-clear', () => cb()) },

  onHibernateTimer: (cb) => { ipcRenderer.on('hibernate:timer', () => cb()) },

  onHibernateSkip: (cb) => { ipcRenderer.on('hibernate:skip', () => cb()) },

  onPopupClosed: (cb) => {
    ipcRenderer.on('popup:closed', (_event, id) => cb(id))
  },

  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  loadPack: (packDir) => ipcRenderer.invoke('pack:load', packDir),

  getScreenBounds: () => ipcRenderer.invoke('screen:bounds'),

  startScripting: () => ipcRenderer.invoke('script:start'),
  stopScripting: () => ipcRenderer.invoke('script:stop'),
  executeScriptFile: (path) => ipcRenderer.invoke('script:execute-file', path),
  executeScriptCode: (code) => ipcRenderer.invoke('script:execute-code', code),
  getScriptingStatus: () => ipcRenderer.invoke('script:status'),

  onScriptStatus: (cb) => {
    ipcRenderer.on('script:status', (_event, status) => cb(status))
  },
  onScriptSpawnPopup: (cb) => {
    ipcRenderer.on('script:spawn-popup', (_event, info) => cb(info))
  },
  onScriptPrompt: (cb) => {
    ipcRenderer.on('script:prompt', (_event, info) => cb(info))
  },
  onScriptCorruptionProgress: (cb) => {
    ipcRenderer.on('script:corruption-progress', () => cb())
  },
  onScriptSetWallpaper: (cb) => {
    ipcRenderer.on('script:set-wallpaper', (_event, info) => cb(info))
  },
  onScriptPanic: (cb) => {
    ipcRenderer.on('script:panic', () => cb())
  },
  onScriptClosePopups: (cb) => {
    ipcRenderer.on('script:close-popups', () => cb())
  },
  onScriptSetMoods: (cb) => {
    ipcRenderer.on('script:set-moods', (_event, info) => cb(info))
  },
  onScriptEnableMood: (cb) => {
    ipcRenderer.on('script:enable-mood', (_event, info) => cb(info))
  },
  onScriptDisableMood: (cb) => {
    ipcRenderer.on('script:disable-mood', (_event, info) => cb(info))
  },
  onScriptSetPopupCloseText: (cb) => {
    ipcRenderer.on('script:set-popup-close-text', (_event, info) => cb(info))
  },
  onScriptSetPromptCommandText: (cb) => {
    ipcRenderer.on('script:set-prompt-command-text', (_event, info) => cb(info))
  },
  onScriptSetPromptSubmitText: (cb) => {
    ipcRenderer.on('script:set-prompt-submit-text', (_event, info) => cb(info))
  },
  onScriptSetPromptMinLength: (cb) => {
    ipcRenderer.on('script:set-prompt-min-length', (_event, info) => cb(info))
  },
  onScriptSetPromptMaxLength: (cb) => {
    ipcRenderer.on('script:set-prompt-max-length', (_event, info) => cb(info))
  },
  onScriptOpenWeb: (cb) => {
    ipcRenderer.on('script:open-web', (_event, info) => cb(info))
  },
  onScriptOpenSubliminal: (cb) => {
    ipcRenderer.on('script:open-subliminal', (_event, info) => cb(info))
  },
  onScriptNotification: (cb) => {
    ipcRenderer.on('script:notification', (_event, info) => cb(info))
  },

  showNotification: (title, body) =>
    ipcRenderer.invoke('notification:show', title, body),

  initDiscord: () =>
    ipcRenderer.invoke('discord:init'),
  updateDiscord: (activity) =>
    ipcRenderer.invoke('discord:update', activity),
  destroyDiscord: () =>
    ipcRenderer.invoke('discord:destroy'),

  openExternal: (url) =>
    ipcRenderer.invoke('web:openExternal', url),
})
