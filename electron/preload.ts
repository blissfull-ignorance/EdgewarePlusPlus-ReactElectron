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
    setActiveMoods: (moods) => ipcRenderer.invoke("pack:setActiveMoods", moods),
    listMoods: () => ipcRenderer.invoke("pack:listMoods"),
    loadPackConfig: () => ipcRenderer.invoke("pack:loadPackConfig"),
    hasScript: () => ipcRenderer.invoke("pack:hasScript"),
    setRuntimePack: (dir) => ipcRenderer.invoke("pack:setRuntimePack", dir),
    listGallery: (packPath) => ipcRenderer.invoke("pack:listGallery", packPath),
    setFavourite: (key, favourite) => ipcRenderer.invoke("pack:setFavourite", key, favourite),
    refreshAppIcon: () => ipcRenderer.invoke("pack:refreshAppIcon"),
    getEditableIndex: (packPath) => ipcRenderer.invoke("pack:getEditableIndex", packPath),
    setFileTags: (packPath, file, tags) => ipcRenderer.invoke("pack:setFileTags", packPath, file, tags),
    deleteFile: (packPath, kind, file) => ipcRenderer.invoke("pack:deleteFile", packPath, kind, file),
    initPack: (folderPath) => ipcRenderer.invoke("pack:initPack", folderPath),
    addMood: (packPath, name) => ipcRenderer.invoke("pack:addMood", packPath, name),
    removeMood: (packPath, name) => ipcRenderer.invoke("pack:removeMood", packPath, name),
    renameMood: (packPath, from, to) => ipcRenderer.invoke("pack:renameMood", packPath, from, to),
    splashImage: () => ipcRenderer.invoke("pack:splashImage"),
    iconImage: () => ipcRenderer.invoke("pack:iconImage"),
    blacklist: (fileName) => ipcRenderer.invoke("pack:blacklistMedia", fileName),
    loadCorruption: () => ipcRenderer.invoke("pack:loadCorruption"),
    discord: () => ipcRenderer.invoke("pack:discord"),
  },
  corruption: {
    persistBaseline: (baseline) => ipcRenderer.invoke("corruption:persistBaseline", baseline),
    revertBaseline: () => ipcRenderer.invoke("corruption:revertBaseline"),
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
    create: (type, mediaId, hypnoGif, pumpScare) =>
      ipcRenderer.invoke("popup:create", type, mediaId, hypnoGif, pumpScare),
    closePopup: (id) => ipcRenderer.invoke("popup:closePopup", id),
    closeAll: () => ipcRenderer.invoke("popup:closeAll"),
    sizeToMedia: (id, mediaWidth, mediaHeight, lowkey) =>
      ipcRenderer.invoke("popup:sizeToMedia", id, mediaWidth, mediaHeight, lowkey),
    startMoving: (id) => ipcRenderer.invoke("popup:startMoving", id),
    dragBegin: (id) => ipcRenderer.invoke("popup:dragBegin", id),
    dragMove: (id, dx, dy) => ipcRenderer.invoke("popup:dragMove", id, dx, dy),
    dragEnd: (id) => ipcRenderer.invoke("popup:dragEnd", id),
    onClosed: (callback: (id: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string) => callback(id);
      ipcRenderer.on("popup:closed", handler);
      return () => {
        ipcRenderer.removeListener("popup:closed", handler);
      };
    },
  },
  hibernate: {
    onSkip: (callback: () => void) => {
      const listener = (): void => callback();
      ipcRenderer.on("hibernate:skip", listener);
      return () => ipcRenderer.removeListener("hibernate:skip", listener);
    },
  },
  scripting: {
    runLua: (scriptName) => ipcRenderer.invoke("scripting:runLua", scriptName),
    runSelfTest: () => ipcRenderer.invoke("scripting:runSelfTest"),
    stop: () => ipcRenderer.invoke("scripting:stop"),
    advanceLevel: () => ipcRenderer.invoke("scripting:advanceLevel"),
    convertScript: (packPath) => ipcRenderer.invoke("scripting:convertScript", packPath),
    readScript: (packPath) => ipcRenderer.invoke("scripting:readScript", packPath),
    writeScript: (packPath, content) => ipcRenderer.invoke("scripting:writeScript", packPath, content),
    writePackDesign: (packPath, lua, corruptionJson) =>
      ipcRenderer.invoke("scripting:writePackDesign", packPath, lua, corruptionJson),
    injectCorruptionLevel: (level) =>
      ipcRenderer.invoke("scripting:injectCorruptionLevel", level),
  },
  system: {
    setWallpaper: (filepath) =>
      ipcRenderer.invoke("system:setWallpaper", filepath),
    quit: () => ipcRenderer.invoke("system:quit"),
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
    selectPackInitFolder: () => ipcRenderer.invoke("system:selectPackInitFolder"),
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
    flushSettings: (values) => ipcRenderer.sendSync("system:saveSettingsSync", values),
    pushSettings: (values) => ipcRenderer.send("system:pushSettings", values),
    saveSettings: (settings) =>
      ipcRenderer.invoke("system:saveSettings", settings),
    sendNotification: (title, message, attachmentPath) =>
      ipcRenderer.invoke("system:sendNotification", title, message, attachmentPath),
    openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
    corruptionLaunches: () => ipcRenderer.invoke("system:corruptionLaunches"),
  },
  wallpaper: {
    restoreOriginal: () => ipcRenderer.invoke("wallpaper:restoreOriginal"),
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
