import { BrowserWindow } from 'electron'
import fs from 'fs'
import { initLuaState, closeLuaState, isLuaRunning, executeScript, createSandboxedLuaState } from '../scripting/engine.js'
import { registerEdgewareV1 } from '../scripting/api_v1.js'
import { registerEdgewareV0 } from '../scripting/api_v0.js'
import { registerBasicV1 } from '../scripting/api_basic.js'
import { CallbackStore } from '../scripting/callbacks.js'
import type { EdgewareCallbacks } from '../scripting/callbacks.js'
import { showNotification } from './notifications.js'

let mainWindowRef: BrowserWindow | null = null
let callbackStore: CallbackStore | null = null

export function setScriptingMainWindow(mw: BrowserWindow): void {
  mainWindowRef = mw
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  mainWindowRef?.webContents.send(channel, ...args)
}

function buildCallbacks(): EdgewareCallbacks {
  return {
    openImage: (filename?: string) => {
      const id = Math.floor(Math.random() * 1_000_000)
      sendToRenderer('script:spawn-popup', { type: 'image', filename, id })
      return id
    },
    openVideo: (filename?: string) => {
      const id = Math.floor(Math.random() * 1_000_000)
      sendToRenderer('script:spawn-popup', { type: 'video', filename, id })
      return id
    },
    playAudio: (filename?: string) => {
      sendToRenderer('script:spawn-popup', { type: 'audio', filename, id: Math.floor(Math.random() * 1_000_000) })
      return 0
    },
    openPrompt: (text?: string) => {
      sendToRenderer('script:prompt', { text: text ?? '' })
      return 0
    },
    after: (_ms: number, _callbackId: string) => {
      // FIXME: Timer-based callback scheduling not yet implemented
    },
    roll: (chance: number) => {
      return Math.random() * 100 < chance
    },
    progressCorruption: () => {
      sendToRenderer('script:corruption-progress')
    },
    setWallpaper: (filename: string) => {
      sendToRenderer('script:set-wallpaper', { filename })
    },
    panic: () => {
      sendToRenderer('script:panic')
    },
    closePopups: () => {
      sendToRenderer('script:close-popups')
    },
    setActiveMoods: (moods: string[]) => {
      sendToRenderer('script:set-moods', { moods })
    },
    enableMood: (mood: string) => {
      sendToRenderer('script:enable-mood', { mood })
    },
    disableMood: (mood: string) => {
      sendToRenderer('script:disable-mood', { mood })
    },
    setPopupCloseText: (text: string) => {
      sendToRenderer('script:set-popup-close-text', { text })
    },
    setPromptCommandText: (text: string) => {
      sendToRenderer('script:set-prompt-command-text', { text })
    },
    setPromptSubmitText: (text: string) => {
      sendToRenderer('script:set-prompt-submit-text', { text })
    },
    setPromptMinLength: (length: number) => {
      sendToRenderer('script:set-prompt-min-length', { length })
    },
    setPromptMaxLength: (length: number) => {
      sendToRenderer('script:set-prompt-max-length', { length })
    },
    openWeb: (url?: string) => {
      sendToRenderer('script:open-web', { url: url ?? '' })
    },
    openSubliminal: (text?: string) => {
      sendToRenderer('script:open-subliminal', { text: text ?? '' })
    },
    sendNotification: (text?: string) => {
      sendToRenderer('script:notification', { text: text ?? '' })
      showNotification('Edgeware++', text ?? '')
    },
    connectOnPopupOpen: (_callbackId: string) => {
      // FIXME: Popup open callback not yet wired
    },
    connectOnPopupClose: (_callbackId: string) => {
      // FIXME: Popup close callback not yet wired
    },
  }
}

export function startScripting(): { success: boolean; error?: string } {
  try {
    if (isLuaRunning()) {
      closeLuaState()
    }
    callbackStore = new CallbackStore()
    initLuaState()

    const L = createSandboxedLuaState()
    const callbacks = buildCallbacks()
    registerBasicV1(L)
    registerEdgewareV0(L, callbacks)
    registerEdgewareV1(L, callbacks)

    sendToRenderer('script:status', { running: true })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendToRenderer('script:status', { running: false, error: message })
    return { success: false, error: message }
  }
}

export function stopScripting(): void {
  callbackStore?.clear()
  callbackStore = null
  closeLuaState()
  sendToRenderer('script:status', { running: false })
}

export function executeLuaScript(scriptPath: string): { success: boolean; error?: string } {
  try {
    if (!isLuaRunning()) {
      return { success: false, error: 'Lua engine not running' }
    }
    const content = fs.readFileSync(scriptPath, 'utf-8')
    executeScript(content)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export function executeLuaCode(code: string): { success: boolean; error?: string } {
  try {
    if (!isLuaRunning()) {
      return { success: false, error: 'Lua engine not running' }
    }
    executeScript(code)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export function getScriptingStatus(): { running: boolean } {
  return { running: isLuaRunning() }
}
