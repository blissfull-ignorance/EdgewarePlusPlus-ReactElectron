import { globalShortcut } from 'electron'

let mainWindow: import('electron').BrowserWindow | null = null

export function registerPanicShortcut(accelerator: string, callback: () => void) {
  const registered = globalShortcut.register(accelerator, callback)
  if (!registered) {
    console.warn(`Global shortcut ${accelerator} failed to register`)
  }
}

export function unregisterPanicShortcut(accelerator: string) {
  globalShortcut.unregister(accelerator)
}

export function setMainWindow(win: import('electron').BrowserWindow) {
  mainWindow = win
}

export function getMainWindow() {
  return mainWindow
}
