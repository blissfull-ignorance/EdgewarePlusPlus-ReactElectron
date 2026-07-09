import { BrowserWindow } from 'electron'
import path from 'path'

const popupWindows = new Map<number, BrowserWindow>()

let nextId = 1

export function createPopupWindow(opts: {
  mediaPath: string
  width: number
  height: number
  x: number
  y: number
  opacity: number
  clickthrough: boolean
}): number {
  const id = nextId++
  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    x: opts.x,
    y: opts.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'popup_preload.js'),
    },
  })

  const url = `file://${opts.mediaPath}?opacity=${opts.opacity}`
  win.loadURL(url)

  if (opts.clickthrough) {
    win.setIgnoreMouseEvents(true)
  }

  win.on('closed', () => {
    popupWindows.delete(id)
  })

  popupWindows.set(id, win)
  return id
}

export function closePopupWindow(id: number): void {
  const win = popupWindows.get(id)
  if (win) {
    win.close()
  }
}

export function movePopupWindow(id: number, x: number, y: number): void {
  const win = popupWindows.get(id)
  if (win) {
    win.setPosition(x, y)
  }
}

export function setPopupClickthrough(id: number, enabled: boolean): void {
  const win = popupWindows.get(id)
  if (win) {
    win.setIgnoreMouseEvents(enabled)
  }
}

export function getAllPopupWindows(): BrowserWindow[] {
  return Array.from(popupWindows.values())
}

export function closeAllPopups(): void {
  getAllPopupWindows().forEach(win => win.close())
}
