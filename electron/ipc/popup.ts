import { BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const popupWindows = new Map<number, BrowserWindow>()

const HEADER_HEIGHT = 28

let nextId = 1
let mainWindowRef: BrowserWindow | null = null

export function setPopupMainWindow(mw: BrowserWindow): void {
  mainWindowRef = mw
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  mainWindowRef?.webContents.send(channel, ...args)
}

export function createPopupWindow(opts: {
  mediaPath: string
  type: 'image' | 'video' | 'audio'
  width: number
  height: number
  x: number
  y: number
  opacity: number
  clickthrough: boolean
  clicksToClose: number
  denialFilter?: string
  hypnoMediaPath?: string
  hypnoOpacity?: number
}): number {
  const id = nextId++
  const popupHtml = path.join(__dirname, '../../electron/popup.html')

  const params = new URLSearchParams({
    mediaPath: opts.mediaPath,
    type: opts.type,
    width: String(opts.width),
    height: String(opts.height),
    opacity: String(opts.opacity),
    clickthrough: String(opts.clickthrough),
    clicksToClose: String(opts.clicksToClose),
  })
  if (opts.denialFilter) params.set('denialFilter', opts.denialFilter)
  if (opts.hypnoMediaPath) params.set('hypnoMediaPath', opts.hypnoMediaPath)
  if (opts.hypnoOpacity !== undefined) params.set('hypnoOpacity', String(opts.hypnoOpacity))

  const win = new BrowserWindow({
    width: Math.max(1, opts.width),
    height: Math.max(1, opts.height + HEADER_HEIGHT),
    x: opts.x,
    y: opts.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  void win.loadURL(`file://${popupHtml}?${params.toString()}`)

  if (opts.clickthrough) {
    win.setIgnoreMouseEvents(true)
  }

  win.on('closed', () => {
    popupWindows.delete(id)
    sendToRenderer('popup:closed', id)
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
