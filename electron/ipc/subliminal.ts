import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const subliminalWindows = new Set<BrowserWindow>()

let nextId = 1

export interface SubliminalOptions {
  text: string
  color: string
  opacity: number
  duration: number
  fontSize: number
}

/**
 * Creates a transparent, click-through, always-on-top full-screen window
 * showing only the subliminal text. The window auto-closes after
 * `duration` milliseconds.
 *
 * Matches the Python original's SubliminalPopup: borderless, topmost,
 * centered on monitor, configurable opacity and timeout.
 */
export function createSubliminalWindow(opts: SubliminalOptions): number {
  const id = nextId++
  const subliminalHtml = path.join(__dirname, '../../electron/subliminal.html')

  const primary = screen.getPrimaryDisplay().bounds

  const params = new URLSearchParams({
    text: opts.text,
    color: opts.color,
    opacity: String(opts.opacity),
    fontSize: String(opts.fontSize),
    duration: String(opts.duration),
  })

  const win = new BrowserWindow({
    x: primary.x,
    y: primary.y,
    width: primary.width,
    height: primary.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  void win.loadURL(`file://${subliminalHtml}?${params.toString()}`)

  // Click-through: the window ignores all mouse events
  win.setIgnoreMouseEvents(true)

  // Auto-close after duration
  const timer = setTimeout(() => {
    if (!win.isDestroyed()) win.close()
  }, opts.duration)

  win.on('closed', () => {
    subliminalWindows.delete(win)
    clearTimeout(timer)
  })

  subliminalWindows.add(win)
  return id
}

export function closeAllSubliminals(): void {
  for (const win of subliminalWindows) {
    if (!win.isDestroyed()) win.close()
  }
}
