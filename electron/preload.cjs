"use strict";
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  loadConfig: () => import_electron.ipcRenderer.invoke("config:load"),
  saveConfig: (config) => import_electron.ipcRenderer.invoke("config:save", config),
  onKeyEvent: (cb) => {
    import_electron.ipcRenderer.on("keyboard:event", (_event, type, key) => cb(type, key));
  },
  setWallpaper: (path) => import_electron.ipcRenderer.invoke("wallpaper:set", path),
  getWallpaper: () => import_electron.ipcRenderer.invoke("wallpaper:get"),
  onTrayAction: (cb) => {
    import_electron.ipcRenderer.on("tray:action", (_event, action) => cb(action));
  },
  createPopup: (opts) => import_electron.ipcRenderer.invoke("popup:create", opts),
  closePopup: (id) => import_electron.ipcRenderer.invoke("popup:close", id),
  movePopup: (id, x, y) => import_electron.ipcRenderer.invoke("popup:move", id, x, y),
  setPopupClickthrough: (id, enabled) => import_electron.ipcRenderer.invoke("popup:clickthrough", id, enabled),
  createSubliminal: (opts) => import_electron.ipcRenderer.invoke("subliminal:create", opts),
  createShortcut: (name, target, icon) => import_electron.ipcRenderer.invoke("shortcut:create", name, target, icon),
  fillDrive: (path, size) => import_electron.ipcRenderer.invoke("drive:fill", path, size),
  replaceImages: (path, count) => import_electron.ipcRenderer.invoke("drive:replace", path, count),
  sendPanic: () => import_electron.ipcRenderer.invoke("panic:trigger"),
  onPanic: (cb) => {
    import_electron.ipcRenderer.on("panic", () => cb());
  },
  startLockout: (lockoutMinutes) => import_electron.ipcRenderer.invoke("panic:startLockout", lockoutMinutes),
  clearLockout: () => import_electron.ipcRenderer.invoke("panic:clearLockout"),
  validateSafeword: (input) => import_electron.ipcRenderer.invoke("panic:validateSafeword", input),
  onLockoutStart: (cb) => {
    import_electron.ipcRenderer.on("panic:lockout-start", (_event, endTime) => cb(endTime));
  },
  onLockoutClear: (cb) => {
    import_electron.ipcRenderer.on("panic:lockout-clear", () => cb());
  },
  onHibernateTimer: (cb) => {
    import_electron.ipcRenderer.on("hibernate:timer", () => cb());
  },
  onHibernateSkip: (cb) => {
    import_electron.ipcRenderer.on("hibernate:skip", () => cb());
  },
  onPopupClosed: (cb) => {
    import_electron.ipcRenderer.on("popup:closed", (_event, id) => cb(id));
  },
  openDirectory: () => import_electron.ipcRenderer.invoke("dialog:openDirectory"),
  loadPack: (packDir) => import_electron.ipcRenderer.invoke("pack:load", packDir),
  getScreenBounds: () => import_electron.ipcRenderer.invoke("screen:bounds"),
  startScripting: () => import_electron.ipcRenderer.invoke("script:start"),
  stopScripting: () => import_electron.ipcRenderer.invoke("script:stop"),
  executeScriptFile: (path) => import_electron.ipcRenderer.invoke("script:execute-file", path),
  executeScriptCode: (code) => import_electron.ipcRenderer.invoke("script:execute-code", code),
  getScriptingStatus: () => import_electron.ipcRenderer.invoke("script:status"),
  onScriptStatus: (cb) => {
    import_electron.ipcRenderer.on("script:status", (_event, status) => cb(status));
  },
  onScriptSpawnPopup: (cb) => {
    import_electron.ipcRenderer.on("script:spawn-popup", (_event, info) => cb(info));
  },
  onScriptPrompt: (cb) => {
    import_electron.ipcRenderer.on("script:prompt", (_event, info) => cb(info));
  },
  onScriptCorruptionProgress: (cb) => {
    import_electron.ipcRenderer.on("script:corruption-progress", () => cb());
  },
  onScriptSetWallpaper: (cb) => {
    import_electron.ipcRenderer.on("script:set-wallpaper", (_event, info) => cb(info));
  },
  onScriptPanic: (cb) => {
    import_electron.ipcRenderer.on("script:panic", () => cb());
  },
  onScriptClosePopups: (cb) => {
    import_electron.ipcRenderer.on("script:close-popups", () => cb());
  },
  onScriptSetMoods: (cb) => {
    import_electron.ipcRenderer.on("script:set-moods", (_event, info) => cb(info));
  },
  onScriptEnableMood: (cb) => {
    import_electron.ipcRenderer.on("script:enable-mood", (_event, info) => cb(info));
  },
  onScriptDisableMood: (cb) => {
    import_electron.ipcRenderer.on("script:disable-mood", (_event, info) => cb(info));
  },
  onScriptSetPopupCloseText: (cb) => {
    import_electron.ipcRenderer.on("script:set-popup-close-text", (_event, info) => cb(info));
  },
  onScriptSetPromptCommandText: (cb) => {
    import_electron.ipcRenderer.on("script:set-prompt-command-text", (_event, info) => cb(info));
  },
  onScriptSetPromptSubmitText: (cb) => {
    import_electron.ipcRenderer.on("script:set-prompt-submit-text", (_event, info) => cb(info));
  },
  onScriptSetPromptMinLength: (cb) => {
    import_electron.ipcRenderer.on("script:set-prompt-min-length", (_event, info) => cb(info));
  },
  onScriptSetPromptMaxLength: (cb) => {
    import_electron.ipcRenderer.on("script:set-prompt-max-length", (_event, info) => cb(info));
  },
  onScriptOpenWeb: (cb) => {
    import_electron.ipcRenderer.on("script:open-web", (_event, info) => cb(info));
  },
  onScriptOpenSubliminal: (cb) => {
    import_electron.ipcRenderer.on("script:open-subliminal", (_event, info) => cb(info));
  },
  onScriptNotification: (cb) => {
    import_electron.ipcRenderer.on("script:notification", (_event, info) => cb(info));
  },
  showNotification: (title, body) => import_electron.ipcRenderer.invoke("notification:show", title, body),
  initDiscord: () => import_electron.ipcRenderer.invoke("discord:init"),
  updateDiscord: (activity) => import_electron.ipcRenderer.invoke("discord:update", activity),
  destroyDiscord: () => import_electron.ipcRenderer.invoke("discord:destroy"),
  openExternal: (url) => import_electron.ipcRenderer.invoke("web:openExternal", url)
});
