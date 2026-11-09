declare module "fengari" {
  export function luastring_of(str: string): Uint8Array;
  export function to_jsstring(u8: Uint8Array): string;
  export function to_luastring(str: string): Uint8Array;
}

declare module "fengari/src/lua" {
  export const LUA_OK: number;
  export const LUA_REGISTRYINDEX: number;
  export const LUA_MULTRET: number;
  export const LUA_TNUMBER: number;
  export const LUA_TSTRING: number;
  export const LUA_TBOOLEAN: number;
  export const LUA_TNIL: number;
  export const LUA_TNONE: number;
  export function lua_close(L: number): void;
  export function lua_pcall(L: number, nargs: number, nresults: number, errfunc: number): number;
  export function lua_gettop(L: number): number;
  export function lua_tojsstring(L: number, idx: number): string | null;
  export function lua_tolstring(L: number, idx: number): Uint8Array | null;
  export function lua_tonumber(L: number, idx: number): number;
  export function lua_toboolean(L: number, idx: number): boolean;
  export function lua_pushnumber(L: number, n: number): void;
  export function lua_pushboolean(L: number, b: number): void;
  export function lua_pushnil(L: number): void;
  export function lua_pushcfunction(L: number, fn: (L: number) => number): void;
  export function lua_isfunction(L: number, idx: number): boolean;
  export function lua_getfield(L: number, idx: number, k: string): void;
  export function lua_setfield(L: number, idx: number, k: string): void;
  export function lua_newtable(L: number): void;
  export function lua_type(L: number, idx: number): number;
  export function lua_setglobal(L: number, name: string): void;
  export function lua_settop(L: number, idx: number): void;
  export function lua_pop(L: number, n: number): void;
  export function lua_rawgeti(L: number, idx: number, n: number): void;
  export function lua_rawseti(L: number, idx: number, n: number): void;
  export function lua_pushvalue(L: number, idx: number): void;
}

declare module "fengari/src/lauxlib" {
  export function luaL_newstate(): number;
  export function luaL_loadstring(L: number, s: Uint8Array): number;
  export function luaL_error(L: number, fmt: Uint8Array): never;
  export function luaL_requiref(L: number, modname: string, openf: (L: number) => number, glb: number): void;
}

declare module "fengari/src/lualib" {
  export function luaopen_base(L: number): number;
  export function luaopen_table(L: number): number;
  export function luaopen_string(L: number): number;
  export function luaopen_math(L: number): number;
}
