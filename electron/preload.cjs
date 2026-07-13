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

  onHibernateTimer: (cb) => { ipcRenderer.on('hibernate:timer', () => cb()) },

  onPopupClosed: (cb) => {
    ipcRenderer.on('popup:closed', (_event, id) => cb(id))
  },

  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  loadPack: (packDir) => ipcRenderer.invoke('pack:load', packDir),
})
