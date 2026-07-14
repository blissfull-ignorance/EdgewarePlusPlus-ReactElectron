import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

let viteProcess: ChildProcess
let electronApp: ElectronApplication
let mainWindow: Page

async function waitForVite(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(1000, () => { req.destroy(); resolve(false) })
    })
    if (ok) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Vite dev server not ready at ${url} within ${timeoutMs}ms`)
}

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json'], { cwd: ROOT, stdio: 'inherit' })
    tsc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tsc exited ${code}`)))
  })

  viteProcess = spawn('npx', ['vite', '--port', '5173'], { cwd: ROOT, stdio: 'pipe' })
  await waitForVite('http://localhost:5173')
})

test.afterAll(async () => {
  viteProcess?.kill()
})

test.beforeEach(async () => {
  electronApp = await electron.launch({
    args: [ROOT, '--dev'],
    cwd: ROOT,
    env: { ...process.env, EDGWARE_NO_DEVTOOLS: '1' },
  })
  mainWindow = await electronApp.firstWindow()
  mainWindow.on('console', msg => {
    console.log(`[browser ${msg.type()}] ${msg.text()}`)
  })
  mainWindow.on('pageerror', err => {
    console.log(`[browser pageerror] ${err.message}`)
  })
})

test.afterEach(async () => {
  await electronApp.close()
})

test.describe('App launch and splash', () => {
  test('splash screen appears and then config panel opens', async () => {
    await mainWindow.waitForLoadState('networkidle')
    
    const allText = await mainWindow.locator('body').innerText({ timeout: 5000 }).catch(() => 'EMPTY')
    console.log('BODY TEXT:', allText)
    
    const html = await mainWindow.innerHTML('#root')
    console.log('ROOT HTML:', html?.substring(0, 1000))

    const configTitle = mainWindow.locator('text=Edgeware++ Configuration')
    await expect(configTitle).toBeVisible({ timeout: 15_000 })
  })

  test('config panel shows tabs', async () => {
    await expect(mainWindow.locator('text=Edgeware++ Configuration')).toBeVisible({ timeout: 15_000 })

    await expect(mainWindow.locator('button:has-text("Start")')).toBeVisible()
    await expect(mainWindow.locator('button:has-text("Popup Types")')).toBeVisible()
    await expect(mainWindow.locator('button:has-text("Pack")')).toBeVisible()
  })
})

test.describe('Popup windows', () => {
  test('popup spawns and can be closed', async () => {
    await expect(mainWindow.locator('text=Edgeware++ Configuration')).toBeVisible({ timeout: 15_000 })

    const popupId: number = await mainWindow.evaluate(async () => {
      return window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 300,
        height: 200,
        x: 100,
        y: 100,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
    })

    expect(popupId).toBeGreaterThan(0)

    const allWindows = electronApp.windows()
    expect(allWindows.length).toBeGreaterThanOrEqual(2)

    const popupWindow = allWindows.find(w => w !== mainWindow)!
    await expect(popupWindow.locator('#header-title')).toBeVisible({ timeout: 5_000 })

    await mainWindow.evaluate(async (id) => {
      await window.electronAPI!.closePopup(id)
    }, popupId)

    await expect.poll(() => electronApp.windows().length).toBe(1)
  })

  test('popup can be moved', async () => {
    await expect(mainWindow.locator('text=Edgeware++ Configuration')).toBeVisible({ timeout: 15_000 })

    const popupId: number = await mainWindow.evaluate(async () => {
      return window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 300,
        height: 200,
        x: 100,
        y: 100,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
    })

    await mainWindow.evaluate(async (id) => {
      await window.electronAPI!.movePopup(id, 500, 500)
    }, popupId)

    await mainWindow.evaluate(async (id) => {
      await window.electronAPI!.closePopup(id)
    }, popupId)

    await expect.poll(() => electronApp.windows().length).toBe(1)
  })

  test('multiple popups can coexist', async () => {
    await expect(mainWindow.locator('text=Edgeware++ Configuration')).toBeVisible({ timeout: 15_000 })

    const ids: number[] = await mainWindow.evaluate(async () => {
      const id1 = await window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 200,
        height: 150,
        x: 50,
        y: 50,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
      const id2 = await window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 200,
        height: 150,
        x: 300,
        y: 300,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
      return [id1, id2]
    })

    expect(ids[0]).not.toBe(ids[1])
    expect(electronApp.windows().length).toBe(3)

    await mainWindow.evaluate(async (ids) => {
      for (const id of ids) {
        await window.electronAPI!.closePopup(id)
      }
    }, ids)

    await expect.poll(() => electronApp.windows().length).toBe(1)
  })
})

test.describe('Panic mode', () => {
  test('panic kills all popups and shows panic screen', async () => {
    await expect(mainWindow.locator('text=Edgeware++ Configuration')).toBeVisible({ timeout: 15_000 })

    await mainWindow.evaluate(async () => {
      await window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 200,
        height: 150,
        x: 50,
        y: 50,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
      await window.electronAPI!.createPopup({
        mediaPath: '/dev/null',
        type: 'image',
        width: 200,
        height: 150,
        x: 300,
        y: 300,
        opacity: 100,
        clickthrough: false,
        clicksToClose: 1,
      })
    })

    expect(electronApp.windows().length).toBe(3)

    await mainWindow.evaluate(async () => {
      await window.electronAPI!.sendPanic()
    })

    await expect.poll(() => electronApp.windows().length).toBe(1)
    await expect(mainWindow.locator('text=PANIC MODE')).toBeVisible({ timeout: 5_000 })
  })
})
