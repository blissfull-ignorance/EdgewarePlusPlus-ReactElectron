import { lua, lauxlib, lualib } from 'fengari'

let L: any | null = null
let _isRunning = false

export function initLuaState(): void {
  if (L) closeLuaState()
  L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)
  _isRunning = true
}

export function closeLuaState(): void {
  if (L) {
    lua.lua_close(L)
    L = null
    _isRunning = false
  }
}

export function isLuaRunning(): boolean {
  return _isRunning
}

export function executeScript(script: string): void {
  if (!L) throw new Error('Lua state not initialized')
  const ok = lua.luaL_loadstring(L, script)
  if (ok !== 0) {
    const err = lua.lua_tojsstring(L, -1)
    lua.lua_pop(L, 1)
    throw new Error(err)
  }
  const result = lua.lua_pcall(L, 0, 0, 0)
  if (result !== 0) {
    const err = lua.lua_tojsstring(L, -1)
    lua.lua_pop(L, 1)
    throw new Error(err)
  }
}

export function createSandboxedLuaState(): any {
  const L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)

  const removeGlobals = [
    'os', 'io', 'dofile', 'loadfile',
    'rawget', 'rawset', 'rawequal',
    'setmetatable', 'getmetatable', 'debug'
  ]
  for (const name of removeGlobals) {
    lua.lua_pushnil(L)
    lua.lua_setglobal(L, name)
  }

  return L
}
