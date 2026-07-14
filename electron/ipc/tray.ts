import { Tray, Menu, nativeImage, type BrowserWindow } from 'electron'

let tray: Tray | null = null

export function createTray(iconPath: string, mainWindow: BrowserWindow) {
  const icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    return
  }

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Panic', click: () => mainWindow.webContents.send('panic') },
    { label: 'Quit', role: 'quit' },
  ])
  tray.setContextMenu(contextMenu)
  tray.setToolTip('Edgeware++')
  tray.setIgnoreDoubleClickEvents(true)
  tray.on('click', () => {
    mainWindow.show()
  })
}

export function setPanicCallback(callback: () => void) {
  if (tray) {
    const menu = Menu.buildFromTemplate([
      { label: 'Panic', click: () => callback() },
      { label: 'Quit', role: 'quit' },
    ])
    tray.setContextMenu(menu)
  }
}

export function updateTrayMenu(
  mainWindow: BrowserWindow,
  opts: { hibernateMode: boolean; toggleHibSkip: boolean },
) {
  if (!tray) return

  const items: Electron.MenuItemConstructorOptions[] = [
    { label: 'Panic', click: () => mainWindow.webContents.send('panic') },
  ]

  if (opts.hibernateMode && opts.toggleHibSkip) {
    items.push({
      label: 'Skip to Hibernate',
      click: () => mainWindow.webContents.send('hibernate:skip'),
    })
  }

  items.push({ label: 'Quit', role: 'quit' })

  tray.setContextMenu(Menu.buildFromTemplate(items))
}
