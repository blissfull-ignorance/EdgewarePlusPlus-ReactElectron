import { lua } from 'fengari'
import { interop } from 'fengari-interop'
import type { EdgewareCallbacks } from './callbacks.js'

export function registerEdgewareV1(
  L: any,
  callbacks: EdgewareCallbacks,
): void {
  lua.lua_newtable(L)

  // ew.open_image({filename, on_close})
  lua.lua_pushliteral(L, 'open_image')
  lua.lua_pushjsfunction(L, (L: any) => {
    const args = interop.tojs(L, 1) as Record<string, unknown>
    const popupId = callbacks.openImage(args?.filename as string)
    if (args?.on_close) {
      void lua.lua_toproxy(L, -1) // fnRef
      // TODO: Store callback
    }
    lua.lua_pushinteger(L, popupId)
    return 1
  })
  lua.lua_settable(L, -3)

  // ew.open_video({filename, on_close})
  lua.lua_pushliteral(L, 'open_video')
  lua.lua_pushjsfunction(L, (L: any) => {
    const args = interop.tojs(L, 1) as Record<string, unknown>
    const popupId = callbacks.openVideo(args?.filename as string)
    lua.lua_pushinteger(L, popupId)
    return 1
  })
  lua.lua_settable(L, -3)

  // ew.play_audio({filename, on_stop})
  lua.lua_pushliteral(L, 'play_audio')
  lua.lua_pushjsfunction(L, (L: any) => {
    const args = interop.tojs(L, 1) as Record<string, unknown>
    callbacks.playAudio(args?.filename as string)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.after(ms, callback)
  lua.lua_pushliteral(L, 'after')
  lua.lua_pushjsfunction(L, (L: any) => {
    void lua.lua_tointeger(L, 1) // ms
    void lua.lua_toproxy(L, 2) // fnRef
    // TODO: Store callback and schedule timer
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.roll(chance)
  lua.lua_pushliteral(L, 'roll')
  lua.lua_pushjsfunction(L, (L: any) => {
    const chance = lua.lua_tointeger(L, 1)
    const result = callbacks.roll(chance)
    lua.lua_pushboolean(L, result)
    return 1
  })
  lua.lua_settable(L, -3)

  // ew.progress_corruption()
  lua.lua_pushliteral(L, 'progress_corruption')
  lua.lua_pushjsfunction(L, () => {
    callbacks.progressCorruption()
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_wallpaper(filename)
  lua.lua_pushliteral(L, 'set_wallpaper')
  lua.lua_pushjsfunction(L, (L: any) => {
    const filename = lua.lua_tojsstring(L, 1)
    callbacks.setWallpaper(filename)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.panic()
  lua.lua_pushliteral(L, 'panic')
  lua.lua_pushjsfunction(L, () => {
    callbacks.panic()
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.close_popups()
  lua.lua_pushliteral(L, 'close_popups')
  lua.lua_pushjsfunction(L, () => {
    callbacks.closePopups()
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_active_moods({mood1, mood2, ...})
  lua.lua_pushliteral(L, 'set_active_moods')
  lua.lua_pushjsfunction(L, (L: any) => {
    const moodsArg = interop.tojs(L, 1) as Record<number, string>
    const moods = Object.values(moodsArg).filter(v => typeof v === 'string')
    callbacks.setActiveMoods(moods)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.enable_mood(mood)
  lua.lua_pushliteral(L, 'enable_mood')
  lua.lua_pushjsfunction(L, (L: any) => {
    const mood = lua.lua_tojsstring(L, 1)
    callbacks.enableMood(mood)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.disable_mood(mood)
  lua.lua_pushliteral(L, 'disable_mood')
  lua.lua_pushjsfunction(L, (L: any) => {
    const mood = lua.lua_tojsstring(L, 1)
    callbacks.disableMood(mood)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_popup_close_text(text)
  lua.lua_pushliteral(L, 'set_popup_close_text')
  lua.lua_pushjsfunction(L, (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.setPopupCloseText(text)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_prompt_command_text(text)
  lua.lua_pushliteral(L, 'set_prompt_command_text')
  lua.lua_pushjsfunction(L, (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.setPromptCommandText(text)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_prompt_submit_text(text)
  lua.lua_pushliteral(L, 'set_prompt_submit_text')
  lua.lua_pushjsfunction(L, (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.setPromptSubmitText(text)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_prompt_min_length(length)
  lua.lua_pushliteral(L, 'set_prompt_min_length')
  lua.lua_pushjsfunction(L, (L: any) => {
    const length = lua.lua_tointeger(L, 1)
    callbacks.setPromptMinLength(length)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.set_prompt_max_length(length)
  lua.lua_pushliteral(L, 'set_prompt_max_length')
  lua.lua_pushjsfunction(L, (L: any) => {
    const length = lua.lua_tointeger(L, 1)
    callbacks.setPromptMaxLength(length)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.open_web(url)
  lua.lua_pushliteral(L, 'open_web')
  lua.lua_pushjsfunction(L, (L: any) => {
    const url = lua.lua_tojsstring(L, 1)
    callbacks.openWeb(url)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.open_subliminal(text)
  lua.lua_pushliteral(L, 'open_subliminal')
  lua.lua_pushjsfunction(L, (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.openSubliminal(text)
    return 0
  })
  lua.lua_settable(L, -3)

  // ew.send_notification(text)
  lua.lua_pushliteral(L, 'send_notification')
  lua.lua_pushjsfunction(L, (L: any) => {
    const text = lua.lua_tojsstring(L, 1)
    callbacks.sendNotification(text)
    return 0
  })
  lua.lua_settable(L, -3)

  lua.lua_setglobal(L, 'ew')
}
