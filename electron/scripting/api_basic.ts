import { lua } from 'fengari'

export function registerBasicV1(L: any): void {
  lua.lua_pushjsfunction(L, (L: any) => {
    const n = lua.lua_gettop(L)
    const parts: string[] = []
    for (let i = 1; i <= n; i++) {
      parts.push(lua.lua_tojsstring(L, i))
    }
    console.log('[Lua]', ...parts)
    return 0
  })
  lua.lua_setglobal(L, 'print')
}
