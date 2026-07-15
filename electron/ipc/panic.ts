/**
 * Panic lockout IPC handler — manages lockout timer and safeword validation
 * in the Electron main process.
 *
 * FUTUREWORK: The Python version uses `root.after()` for the timer. The
 * Electron version uses `setTimeout` and sends lockout events to the renderer
 * via webContents.send().
 */

import { BrowserWindow, ipcMain } from 'electron'

let lockoutTimer: ReturnType<typeof setTimeout> | null = null
let mainWindow: BrowserWindow | null = null
let currentSafeword = 'password'

export function setPanicMainWindow(win: BrowserWindow) {
  mainWindow = win
}

export function updateSafeword(safeword: string) {
  currentSafeword = safeword
}

function clearLockoutTimer() {
  if (lockoutTimer) {
    clearTimeout(lockoutTimer)
    lockoutTimer = null
  }
}

export function registerPanicHandlers() {
  ipcMain.handle('panic:startLockout', async (_event, lockoutMinutes: number) => {
    clearLockoutTimer()
    const ms = Math.max(1, lockoutMinutes) * 60 * 1000
    const endTime = Date.now() + ms

    mainWindow?.webContents.send('panic:lockout-start', endTime)

    lockoutTimer = setTimeout(() => {
      mainWindow?.webContents.send('panic:lockout-clear')
      lockoutTimer = null
    }, ms)

    return endTime
  })

  ipcMain.handle('panic:clearLockout', async () => {
    clearLockoutTimer()
    mainWindow?.webContents.send('panic:lockout-clear')
  })

  ipcMain.handle('panic:validateSafeword', async (_event, input: string) => {
    const valid = input === currentSafeword
    if (valid) {
      clearLockoutTimer()
      mainWindow?.webContents.send('panic:lockout-clear')
    }
    return { valid }
  })
}
