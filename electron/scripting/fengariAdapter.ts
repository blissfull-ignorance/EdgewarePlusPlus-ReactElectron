/**
 * Fengari Lua VM adapter — creates and manages a Fengari Lua state with
 * a sandboxed corruption API for pack scripts.
 *
 * This module runs in the Electron main process. It provides:
 * - Lua state creation with standard libraries (base, table, string, math)
 * - A sandboxed `corruption` table exposing only safe functions
 * - Script execution with error isolation
 */

import * as lua from "fengari/src/lua";
import * as lauxlib from "fengari/src/lauxlib";
import * as lualib from "fengari/src/lualib";
import { luastring_of } from "fengari";
import { logger } from "../utils/logger";

const {
  lua_close,
  lua_pcall,
  lua_gettop,
  lua_tojsstring,
  lua_tolstring,
  lua_tonumber,
  lua_toboolean,
  lua_pushnumber,
  lua_pushcfunction,
  lua_isfunction,
  lua_setfield,
  lua_newtable,
  lua_type,
  lua_setglobal,
  lua_settop,
  lua_pop,
  lua_rawgeti,
  lua_rawseti,
  lua_pushvalue,
  LUA_TNUMBER,
  LUA_TSTRING,
  LUA_TBOOLEAN,
  LUA_TNIL,
  LUA_TNONE,
  LUA_OK,
  LUA_REGISTRYINDEX,
  LUA_MULTRET,
} = lua;

const {
  luaL_newstate,
  luaL_loadstring,
  luaL_error,
  luaL_requiref,
} = lauxlib;

const {
  luaopen_base,
  luaopen_table,
  luaopen_string,
  luaopen_math,
} = lualib;

/**
 * Convert a luastring (Uint8Array) to a JS string, with a fallback.
 */
function luastringToString(u8: Uint8Array | null | undefined): string {
  if (!u8) return "";
  try {
    return new globalThis.TextDecoder().decode(u8);
  } catch {
    return "";
  }
}

/**
 * Result of executing a Lua script.
 */
export interface LuaExecResult {
  success: boolean;
  error?: string;
  returnValue?: unknown;
}

/**
 * Fengari Lua VM instance with a sandboxed corruption API.
 */
export class FengariVM {
  private L: number;
  private transitionCallbacks: Map<number, number>;
  private callbackCounter: number;
  private _currentLevel: number;
  private _initialized: boolean;

  constructor() {
    this.L = 0;
    this.transitionCallbacks = new Map();
    this.callbackCounter = 0;
    this._currentLevel = 0;
    this._initialized = false;
    try {
      this.L = luaL_newstate();
      this.openSafeLibraries();
      this.registerCorruptionAPI();
      this._initialized = true;
    } catch {
      this.L = 0;
      this._initialized = false;
    }
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Open only safe Lua libraries (base, table, string, math).
   * Excludes io, os, package, coroutine, debug, utf8 for sandboxing.
   */
  private openSafeLibraries(): void {
    luaL_requiref(this.L, "_G", luaopen_base, 1);
    lua_pop(this.L, 1);
    luaL_requiref(this.L, "table", luaopen_table, 0);
    lua_pop(this.L, 1);
    luaL_requiref(this.L, "string", luaopen_string, 0);
    lua_pop(this.L, 1);
    luaL_requiref(this.L, "math", luaopen_math, 0);
    lua_pop(this.L, 1);
  }

  /**
   * Destroy the Lua state and free resources.
   */
  destroy(): void {
    if (this._initialized && this.L) {
      try {
        lua_close(this.L);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.transitionCallbacks.clear();
    this._initialized = false;
    this.L = 0;
  }

  /**
   * Execute a Lua script string and return the result.
   */
  exec(script: string): LuaExecResult {
    if (!this._initialized) {
      return { success: false, error: "Lua VM not initialized" };
    }

    let loadResult: number;
    try {
      loadResult = luaL_loadstring(this.L, luastring_of(script));
    } catch (err) {
      this._initialized = false;
      return { success: false, error: `Load crash: ${err instanceof Error ? err.message : String(err)}` };
    }

    if (loadResult !== LUA_OK) {
      let err = "Unknown load error";
      try {
        const errRaw = lua_tojsstring(this.L, -1);
        if (errRaw) err = errRaw;
        lua_pop(this.L, 1);
      } catch {
        this._initialized = false;
      }
      return { success: false, error: `Load error: ${err}` };
    }

    let pcallResult: number;
    const top = lua_gettop(this.L);
    try {
      pcallResult = lua_pcall(this.L, 0, LUA_MULTRET, 0);
    } catch (err) {
      this._initialized = false;
      return { success: false, error: `PCall crash: ${err instanceof Error ? err.message : String(err)}` };
    }

    if (pcallResult !== LUA_OK) {
      let err = "Unknown runtime error";
      try {
        const errRaw = lua_tojsstring(this.L, -1);
        if (errRaw) err = errRaw;
        lua_pop(this.L, 1);
      } catch {
        this._initialized = false;
      }
      return { success: false, error: `Runtime error: ${err}` };
    }

    let returnValue: unknown;
    try {
      returnValue = this.stackToJS(top + 1);
      lua_settop(this.L, top);
    } catch (err) {
      this._initialized = false;
      return { success: false, error: `Result read crash: ${err instanceof Error ? err.message : String(err)}` };
    }

    return { success: true, returnValue };
  }

  /**
   * Trigger a registered transition callback for the given level.
   */
  triggerTransition(level: number): unknown[] {
    if (!this._initialized) return [];
    const results: unknown[] = [];
    for (const [cbLevel, luaRef] of this.transitionCallbacks) {
      if (cbLevel !== level) continue;
      lua_rawgeti(this.L, LUA_REGISTRYINDEX, luaRef);
      if (!lua_isfunction(this.L, -1)) {
        lua_pop(this.L, 1);
        continue;
      }
      lua_pushnumber(this.L, level);
      if (lua_pcall(this.L, 1, 1, 0) !== LUA_OK) {
        const errRaw = lua_tojsstring(this.L, -1);
        logger.error(`[FengariVM] Transition callback error: ${errRaw ?? "unknown"}`);
        lua_pop(this.L, 1);
      } else {
        results.push(this.stackToJS(-1));
        lua_pop(this.L, 1);
      }
    }
    return results;
  }

  /**
   * Register the sandboxed `corruption` table with safe functions.
   */
  private registerCorruptionAPI(): void {
    lua_newtable(this.L);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const corruptionVm = this;

    // corruption.onTransition(level, callback)
    lua_pushcfunction(this.L, (L: number): number => {
      const level = lua_tonumber(L, 1);
      if (!lua_isfunction(L, 2)) {
        luaL_error(L, luastring_of("onTransition: second argument must be a function"));
        return 0;
      }
      corruptionVm.callbackCounter++;
      const luaRef = corruptionVm.callbackCounter;
      lua_pushvalue(L, 2);
      lua_rawseti(L, LUA_REGISTRYINDEX, luaRef);
      corruptionVm.transitionCallbacks.set(Math.floor(level), luaRef);
      return 0;
    });
    lua_setfield(this.L, -2, "onTransition");

    // corruption.transitionTo(level)
    lua_pushcfunction(this.L, (L: number): number => {
      const level = lua_tonumber(L, 1);
      corruptionVm.notifyRenderer("transitionTo", { level: Math.floor(level) });
      return 0;
    });
    lua_setfield(this.L, -2, "transitionTo");

    // corruption.playAudio(filename)
    lua_pushcfunction(this.L, (L: number): number => {
      const filename = lua_tojsstring(L, 1) ?? "";
      corruptionVm.notifyRenderer("playAudio", { filename });
      return 0;
    });
    lua_setfield(this.L, -2, "playAudio");

    // corruption.closePopups()
    lua_pushcfunction(this.L, (): number => {
      this.notifyRenderer("closePopups", {});
      return 0;
    });
    lua_setfield(this.L, -2, "closePopups");

    // corruption.panic()
    lua_pushcfunction(this.L, (): number => {
      this.notifyRenderer("panic", {});
      return 0;
    });
    lua_setfield(this.L, -2, "panic");

    // corruption.getCurrentLevel()
    lua_pushcfunction(this.L, (L: number): number => {
      lua_pushnumber(L, this._currentLevel);
      return 1;
    });
    lua_setfield(this.L, -2, "getCurrentLevel");

    lua_setglobal(this.L, "corruption");
  }

  /**
   * Send a message to the renderer about a Lua action.
   */
  private notifyRenderer(action: string, data: Record<string, unknown>): void {
    if (this.onLuaEvent) {
      this.onLuaEvent(action, data);
    }
  }

  /**
   * Event handler for Lua-initiated actions.
   */
  onLuaEvent: ((action: string, data: Record<string, unknown>) => void) | null = null;

  /**
   * Set the current corruption level for the Lua API.
   */
  setCurrentLevel(level: number): void {
    this._currentLevel = level;
  }

  getCurrentLevel(): number {
    return this._currentLevel;
  }

  /**
   * Convert a value at a stack index to a JS value.
   */
  private stackToJS(index: number): unknown {
    const type = lua_type(this.L, index);
    if (type === LUA_TNUMBER) return lua_tonumber(this.L, index);
    if (type === LUA_TSTRING) {
      const jsStr = lua_tojsstring(this.L, index);
      if (jsStr) return jsStr;
      const u8 = lua_tolstring(this.L, index);
      return luastringToString(u8);
    }
    if (type === LUA_TBOOLEAN) return lua_toboolean(this.L, index);
    if (type === LUA_TNIL || type === LUA_TNONE) return null;
    return `[lua:${type}]`;
  }
}

// ── Global state ──────────────────────────────────────────────────────────────

let vm: FengariVM | null = null;

/**
 * Initialize or reinitialize the Fengari Lua VM.
 */
export function initLuaVM(): FengariVM {
  if (vm) {
    vm.destroy();
  }
  vm = new FengariVM();
  if (!vm.initialized) {
    logger.warn("[FengariVM] Initialization failed — Lua scripting will be unavailable");
  }
  return vm;
}

/**
 * Get the current VM instance (may be null if not initialized).
 */
export function getLuaVM(): FengariVM | null {
  return vm;
}

/**
 * Destroy the global VM instance.
 */
export function destroyLuaVM(): void {
  if (vm) {
    vm.destroy();
    vm = null;
  }
}
