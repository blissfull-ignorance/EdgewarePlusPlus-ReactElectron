import { lua } from 'fengari'
import type { EdgewareCallbacks } from './callbacks.js'

function registerGlobal(L: any, name: string, fn: (L: any) => number): void {
  lua.lua_pushjsfunction(L, fn)
  lua.lua_setglobal(L, name)
}

export function registerEdgewareV0(
  L: any,
  callbacks: EdgewareCallbacks,
): void {
  // image(filename) — positional, no table args
  registerGlobal(L, 'image', (L: any) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.openImage(filename || undefined)
    return 0
  })

  // video(filename)
  registerGlobal(L, 'video', (L: any) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.openVideo(filename || undefined)
    return 0
  })

  // audio(filename, on_stop)
  registerGlobal(L, 'audio', (L: any) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.playAudio(filename || undefined)
    return 0
  })

  // corrupt()
  registerGlobal(L, 'corrupt', () => {
    callbacks.progressCorruption()
    return 0
  })

  // panic()
  registerGlobal(L, 'panic', () => {
    callbacks.panic()
    return 0
  })

  // close_popups()
  registerGlobal(L, 'close_popups', () => {
    callbacks.closePopups()
    return 0
  })

  // after(ms, callback)
  registerGlobal(L, 'after', (L: any) => {
    void lua.lua_tointeger(L, 1) // ms
    // TODO: Store callback and schedule timer
    return 0
  })

  // roll(chance)
  registerGlobal(L, 'roll', (L: any) => {
    const chance = lua.lua_tointeger(L, 1)
    const result = callbacks.roll(chance)
    lua.lua_pushboolean(L, result)
    return 1
  })

  // prompt(text, on_close)
  registerGlobal(L, 'prompt', (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.openPrompt(text || undefined)
    return 0
  })

  // web(link)
  registerGlobal(L, 'web', (L: any) => {
    const link = lua.lua_tojsstring(L, 1)
    callbacks.openWeb(link || undefined)
    return 0
  })

  // subliminal(text)
  registerGlobal(L, 'subliminal', (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.openSubliminal(text || undefined)
    return 0
  })

  // notification(text)
  registerGlobal(L, 'notification', (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.sendNotification(text || undefined)
    return 0
  })

  // set_popup_close_text(text)
  registerGlobal(L, 'set_popup_close_text', (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.setPopupCloseText(text)
    return 0
  })
}
