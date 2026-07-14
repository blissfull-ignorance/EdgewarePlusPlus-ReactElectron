import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { setWallpaper, getWallpaper } from './ipc/wallpaper.js'
import { createTray } from './ipc/tray.js'
import { createPopupWindow, closePopupWindow, movePopupWindow, setPopupClickthrough, closeAllPopups, setPopupMainWindow } from './ipc/popup.js'
import { createShortcut } from './ipc/shortcut.js'
import { fillDrive, replaceImages } from './ipc/filesystem.js'
import { loadConfig, saveConfig } from './ipc/config.js'
import { loadPackFromDirectory, extractPackZip, isZipFile } from './ipc/pack.js'
import { setScriptingMainWindow, startScripting, stopScripting, executeLuaScript, executeLuaCode, getScriptingStatus } from './ipc/scripting.js'
import { showNotification } from './ipc/notifications.js'
import { initDiscord, updateDiscord, destroyDiscord } from './ipc/discord.js'
import { openExternal } from './ipc/web.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('--dev')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hiddenInset',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    if (!process.env.EDGWARE_NO_DEVTOOLS) {
      mainWindow.webContents.openDevTools()
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  setPopupMainWindow(mainWindow)
  setScriptingMainWindow(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupTray() {
  if (!mainWindow) return
  const iconPath = path.join(__dirname, '../assets/tray-icon.png')
  createTray(iconPath, mainWindow)
}

function registerIpcHandlers() {
  ipcMain.handle('config:load', async () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', async (_event, config) => {
    saveConfig(config)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory'],
      title: 'Select Pack (folder or .zip)',
      filters: [{ name: 'Pack ZIP', extensions: ['zip'] }],
    })
    if (result.canceled) return null
    const selectedPath = result.filePaths[0]
    if (isZipFile(selectedPath)) {
      return extractPackZip(selectedPath)
    }
    return selectedPath
  })

  ipcMain.handle('pack:load', async (_event, packDir: string) => {
    return loadPackFromDirectory(packDir)
  })

  ipcMain.handle('wallpaper:set', async (_event, wallpaperPath: string) => {
    await setWallpaper(wallpaperPath)
  })

  ipcMain.handle('wallpaper:get', async (): Promise<string> => {
    return getWallpaper()
  })

  ipcMain.handle('popup:create', async (_event, opts) => {
    return createPopupWindow(opts)
  })

  ipcMain.handle('popup:close', async (_event, id: number) => {
    closePopupWindow(id)
  })

  ipcMain.handle('popup:move', async (_event, id: number, x: number, y: number) => {
    movePopupWindow(id, x, y)
  })

  ipcMain.handle('popup:clickthrough', async (_event, id: number, enabled: boolean) => {
    setPopupClickthrough(id, enabled)
  })

  ipcMain.handle('shortcut:create', async (_event, name: string, target: string, icon: string) => {
    await createShortcut(name, target, icon)
  })

  ipcMain.handle('drive:fill', async (_event, drivePath: string, size: number) => {
    await fillDrive(drivePath, size)
  })

  ipcMain.handle('drive:replace', async (_event, drivePath: string, count: number) => {
    await replaceImages(drivePath, count, [])
  })

  ipcMain.handle('panic:trigger', async () => {
    closeAllPopups()
    mainWindow?.webContents.send('panic')
  })

  ipcMain.handle('screen:bounds', async () => {
    const primary = screen.getPrimaryDisplay().bounds
    return { x: primary.x, y: primary.y, width: primary.width, height: primary.height }
  })

  ipcMain.handle('script:start', async () => {
    return startScripting()
  })

  ipcMain.handle('script:stop', async () => {
    stopScripting()
  })

  ipcMain.handle('script:execute-file', async (_event, scriptPath: string) => {
    return executeLuaScript(scriptPath)
  })

  ipcMain.handle('script:execute-code', async (_event, code: string) => {
    return executeLuaCode(code)
  })

  ipcMain.handle('script:status', async () => {
    return getScriptingStatus()
  })

  ipcMain.handle('notification:show', async (_event, title: string, body: string) => {
    showNotification(title, body)
  })

  ipcMain.handle('discord:init', async () => {
    return initDiscord()
  })

  ipcMain.handle('discord:update', async (_event, activity) => {
    return updateDiscord(activity)
  })

  ipcMain.handle('discord:destroy', async () => {
    destroyDiscord()
  })

  ipcMain.handle('web:openExternal', async (_event, url: string) => {
    await openExternal(url)
  })
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

app.whenReady().then(() => {
  createWindow()
  setupTray()
  registerIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  destroyDiscord()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
