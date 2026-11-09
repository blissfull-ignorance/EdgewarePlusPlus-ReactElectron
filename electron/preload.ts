import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import type { ElectronAPI, ImportProgress } from "../src/types/ipc";

const electronAPI: ElectronAPI = {
  pack: {
    loadInfo: () => ipcRenderer.invoke("pack:loadInfo"),
    loadIndex: () => ipcRenderer.invoke("pack:loadIndex"),
    listFiles: (dir) => ipcRenderer.invoke("pack:listFiles", dir),
    randomImage: () => ipcRenderer.invoke("pack:randomImage"),
    randomAudio: () => ipcRenderer.invoke("pack:randomAudio"),
    randomVideo: () => ipcRenderer.invoke("pack:randomVideo"),
    closeLabel: () => ipcRenderer.invoke("pack:closeLabel"),
    randomPrompt: () => ipcRenderer.invoke("pack:randomPrompt"),
    randomWeb: () => ipcRenderer.invoke("pack:randomWeb"),
    randomHypnoGif: () => ipcRenderer.invoke("pack:randomHypnoGif"),
    randomSubliminalText: () => ipcRenderer.invoke("pack:randomSubliminalText"),
    randomNotificationText: () => ipcRenderer.invoke("pack:randomNotificationText"),
    splashImage: () => ipcRenderer.invoke("pack:splashImage"),
    blacklist: (fileName) => ipcRenderer.invoke("pack:blacklistMedia", fileName),
    loadCorruption: () => ipcRenderer.invoke("pack:loadCorruption"),
    discord: () => ipcRenderer.invoke("pack:discord"),
  },
  corruption: {
    getCurrentLevel: () => ipcRenderer.invoke("corruption:getCurrentLevel"),
    getNextLevelTime: () => ipcRenderer.invoke("corruption:getNextLevelTime"),
    applyLevelChanges: (changes) =>
      ipcRenderer.invoke("corruption:applyLevelChanges", changes),
    setLevel: (level, nextLevelTime) =>
      ipcRenderer.invoke("corruption:setLevel", level, nextLevelTime),
    onInject: (callback: (level: number) => void) => {
      const handler = (_event: IpcRendererEvent, level: number) => callback(level);
      ipcRenderer.on("corruption:inject", handler);
      return () => {
        ipcRenderer.removeListener("corruption:inject", handler);
      };
    },
    onApplyChanges: (callback: (changes: Record<string, unknown>) => void) => {
      const handler = (_event: IpcRendererEvent, changes: Record<string, unknown>) =>
        callback(changes);
      ipcRenderer.on("corruption:applyChanges", handler);
      return () => {
        ipcRenderer.removeListener("corruption:applyChanges", handler);
      };
    },
  },
  popup: {
    create: (type, mediaId, hypnoGif) => ipcRenderer.invoke("popup:create", type, mediaId, hypnoGif),
    closePopup: (id) => ipcRenderer.invoke("popup:closePopup", id),
    closeAll: () => ipcRenderer.invoke("popup:closeAll"),
    onClosed: (callback: (id: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string) => callback(id);
      ipcRenderer.on("popup:closed", handler);
      return () => {
        ipcRenderer.removeListener("popup:closed", handler);
      };
    },
  },
  hibernate: {
    start: (type, durationInSec) =>
      ipcRenderer.invoke("hibernate:start", type, durationInSec),
    stop: () => ipcRenderer.invoke("hibernate:stop"),
  },
  scripting: {
    runLua: (scriptName) => ipcRenderer.invoke("scripting:runLua", scriptName),
    injectCorruptionLevel: (level) =>
      ipcRenderer.invoke("scripting:injectCorruptionLevel", level),
  },
  system: {
    setWallpaper: (filepath) =>
      ipcRenderer.invoke("system:setWallpaper", filepath),
    createDesktopIcons: (options) =>
      ipcRenderer.invoke("system:createDesktopIcons", options),
    createTray: () =>
      ipcRenderer.invoke("system:createTray"),
    toggleRunAtStartup: (state) =>
      ipcRenderer.invoke("system:toggleRunAtStartup", state),
    setDiscordPresence: (text, imageId) =>
      ipcRenderer.invoke("system:setDiscordPresence", text, imageId),
    listPacks: () => ipcRenderer.invoke("system:listPacks"),
    importPack: (filepath) => ipcRenderer.invoke("system:importPack", filepath),
    selectZip: () => ipcRenderer.invoke("system:selectZip"),
    selectPackFolder: () => ipcRenderer.invoke("system:selectPackFolder"),
    validatePackFolder: (folderPath) =>
      ipcRenderer.invoke("system:validatePackFolder", folderPath),
    openPackLibrary: () => ipcRenderer.invoke("system:openPackLibrary"),
    onImportProgress: (callback: (progress: ImportProgress) => void) => {
      const handler = (_event: IpcRendererEvent, progress: ImportProgress) =>
        callback(progress);
      ipcRenderer.on("system:packImportProgress", handler);
      return () => {
        ipcRenderer.removeListener("system:packImportProgress", handler);
      };
    },
    getPathForFile: (file: File): string | null => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return null;
      }
    },
    loadSettings: () => ipcRenderer.invoke("system:loadSettings"),
    saveSettings: (settings) =>
      ipcRenderer.invoke("system:saveSettings", settings),
    sendNotification: (title, message, attachmentPath) =>
      ipcRenderer.invoke("system:sendNotification", title, message, attachmentPath),
    openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
    corruptionLaunches: () => ipcRenderer.invoke("system:corruptionLaunches"),
  },
  booru: {
    fetchImage: (tags) => ipcRenderer.invoke("booru:fetchImage", tags),
  },
  panic: {
    trigger: (opts) => ipcRenderer.invoke("panic:trigger", opts),
    status: () => ipcRenderer.invoke("panic:status"),
    unlock: (password) => ipcRenderer.invoke("panic:unlock", password),
    refreshShortcut: () => ipcRenderer.invoke("panic:refreshShortcut"),
    onBlocked: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("panic:blocked", handler);
      return () => {
        ipcRenderer.removeListener("panic:blocked", handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("api", electronAPI);
