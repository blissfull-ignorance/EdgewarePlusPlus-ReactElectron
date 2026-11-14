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
// lua_sethook/LUA_MASKCOUNT exist at runtime but are missing from fengari's typings.
const { lua_sethook, LUA_MASKCOUNT, lua_getglobal, lua_istable } = lua as unknown as {
  lua_sethook: (
    L: number,
    func: (() => void) | null,
    mask: number,
    count: number
  ) => number;
  LUA_MASKCOUNT: number;
  lua_getglobal: (L: number, name: Uint8Array) => number;
  lua_istable: (L: number, index: number) => boolean;
};
import * as lauxlib from "fengari/src/lauxlib";
import * as lualib from "fengari/src/lualib";
import { to_luastring } from "fengari";
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
  lua_pushboolean,
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
  lua_pushnil,
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
 * Host operations behind the `edgeware_v0` Lua API (legacy pack scripting).
 * Popup-spawning operations return the spawned popup's id, or null when
 * nothing could be spawned (missing pack media); pending Lua callbacks are
 * then invoked immediately instead of on popup close.
 */
export interface EdgewareHost {
  corrupt(): void;
  panic(): void;
  closePopups(): void;
  setPopupCloseText(text: string): void;
  image(file: string | null): string | null;
  video(file: string | null): string | null;
  audio(file: string | null): string | null;
  prompt(text: string | null): string | null;
  subliminal(text: string | null): string | null;
  web(url: string | null): void;
  notification(text: string | null): void;
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
  private host: EdgewareHost | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private pendingByPopup = new Map<string, number[]>();

  constructor() {
    this.L = 0;
    this.transitionCallbacks = new Map();
    // Lua's registry reserves integer keys 1 (main thread) and 2 (globals);
    // callback refs must start above LUA_RIDX_LAST or they clobber the
    // registry — a clobbered globals slot surfaces as a panic the first
    // time any C-side lua_getglobal runs.
    this.callbackCounter = 2;
    this._currentLevel = 0;
    this._initialized = false;
    try {
      this.L = luaL_newstate();
      this.openSafeLibraries();
      this.registerCorruptionAPI();
      this.registerEdgewareV0();
      this._initialized = true;
    } catch {
      this.L = 0;
      this._initialized = false;
    }
  }

  /** Wire the runtime operations behind the edgeware_v0 globals. */
  setHost(host: EdgewareHost | null): void {
    this.host = host;
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
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.pendingByPopup.clear();
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
   * A pack script runs synchronously on the main-process event loop, so a
   * runaway loop would freeze the whole app. A counted debug hook aborts any
   * single protected call that outlives the budget; the state stays usable.
   */
  private runProtected(ms: number, call: () => number): number {
    const deadline = Date.now() + ms;
    lua_sethook(
      this.L,
      () => {
        if (Date.now() > deadline) {
          throw new Error("Lua execution budget exceeded");
        }
      },
      LUA_MASKCOUNT,
      20000
    );
    try {
      return call();
    } catch {
      return -1;
    } finally {
      lua_sethook(this.L, () => undefined, 0, 0);
    }
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
      loadResult = luaL_loadstring(this.L, to_luastring(script));
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
      pcallResult = this.runProtected(5000, () => lua_pcall(this.L, 0, LUA_MULTRET, 0));
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
      // lua_pcall pops the chunk, so the first return value sits at `top`
      // itself; clearing to top - 1 releases every result.
      if (lua_gettop(this.L) >= top) {
        returnValue = this.stackToJS(top);
      }
      lua_settop(this.L, top - 1);
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
        luaL_error(L, to_luastring("onTransition: second argument must be a function"));
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

  // ── Lua callback refs ──────────────────────────────────────────────────────

  /** Keep a Lua function from the stack alive under a fresh registry ref. */
  private storeRef(stackIndex: number): number {
    const ref = ++this.callbackCounter;
    lua_pushvalue(this.L, stackIndex);
    lua_rawseti(this.L, LUA_REGISTRYINDEX, ref);
    return ref;
  }

  /** Call a stored Lua function with no arguments and release the ref. */
  invokeRef(ref: number): void {
    if (!this._initialized) return;
    lua_rawgeti(this.L, LUA_REGISTRYINDEX, ref);
    if (lua_isfunction(this.L, -1)) {
      if (this.runProtected(2000, () => lua_pcall(this.L, 0, 0, 0)) !== LUA_OK) {
        const err = lua_tojsstring(this.L, -1);
        logger.error(`[FengariVM] Lua callback error: ${err ?? "unknown"}`);
      }
    }
    lua_pop(this.L, 1);
    lua_pushnil(this.L);
    lua_rawseti(this.L, LUA_REGISTRYINDEX, ref);
  }

  /** Route a popup-close event to the Lua callbacks waiting on it. */
  handlePopupClosed(id: string): void {
    const refs = this.pendingByPopup.get(id);
    if (!refs) return;
    this.pendingByPopup.delete(id);
    for (const ref of refs) this.invokeRef(ref);
  }

  /**
   * Abandon the script's pending work: un-fired after() timers and on_stop
   * callbacks waiting on popups. A manual corruption skip uses this to end
   * the current scripted event; nothing scheduled is invoked.
   */
  cancelPendingChain(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.pendingByPopup.clear();
  }

  /**
   * Run a generated script's level body directly through the edgeware_levels
   * registry the designer emits, so a manual skip resumes the chain at the
   * new level instead of leaving the old chain to advance on its own.
   * Returns false for hand-written scripts without the registry or for
   * levels beyond the script's end.
   */
  runLevel(level: number): boolean {
    if (!this._initialized || !this.L || !Number.isInteger(level) || level < 1) return false;
    lua_getglobal(this.L, to_luastring("edgeware_levels"));
    if (!lua_istable(this.L, -1)) {
      lua_pop(this.L, 1);
      return false;
    }
    lua_rawgeti(this.L, -1, level);
    const found = lua_isfunction(this.L, -1);
    // Slots above the table after the attempt: pcall consumes the function
    // and leaves nothing on success, or the error message in its place.
    let above = 1;
    if (found) {
      if (this.runProtected(2000, () => lua_pcall(this.L, 0, 0, 0)) !== LUA_OK) {
        const err = lua_tojsstring(this.L, -1);
        logger.error(`[FengariVM] Skipped level body error: ${err ?? "unknown"}`);
      } else {
        above = 0;
      }
    }
    lua_pop(this.L, above + 1); // + the registry table
    return found;
  }

  /** Attach a callback ref to a spawned popup, or fire it when none spawned. */
  private bindPopupRef(popupId: string | null, ref: number | null): void {
    if (ref == null) return;
    if (popupId) {
      const list = this.pendingByPopup.get(popupId) ?? [];
      list.push(ref);
      this.pendingByPopup.set(popupId, list);
    } else {
      this.invokeRef(ref);
    }
  }

  // ── edgeware_v0 pack scripting API (legacy globals) ────────────────────────

  /**
   * Register the legacy `edgeware_v0` globals: after, roll, corrupt, panic,
   * close_popups, set_popup_close_text, image, video, audio, prompt,
   * subliminal, web, notification. `require` accepts the known module names
   * so unmodified pack scripts load.
   */
  private registerEdgewareV0(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const vm = this;

    const argString = (L: number, idx: number): string | null => {
      const t = lua_type(L, idx);
      if (t === LUA_TNIL || t === LUA_TNONE) return null;
      return lua_tojsstring(L, idx);
    };

    // print(...) — legacy routes script output into the app log.
    lua_pushcfunction(this.L, (L: number): number => {
      const n = lua_gettop(L);
      const parts: string[] = [];
      for (let i = 1; i <= n; i++) {
        const t = lua_type(L, i);
        if (t === LUA_TSTRING || t === LUA_TNUMBER) parts.push(lua_tojsstring(L, i) ?? "");
        else if (t === LUA_TBOOLEAN) parts.push(lua_toboolean(L, i) ? "true" : "false");
        else if (t === LUA_TNIL || t === LUA_TNONE) parts.push("nil");
        else parts.push("table");
      }
      logger.info(`[Lua] ${parts.join("\t")}`);
      return 0;
    });
    lua_setglobal(this.L, "print");

    // require("edgeware_v0") — the API is pre-registered; accept known modules.
    lua_pushcfunction(this.L, (L: number): number => {
      const name = lua_tojsstring(L, 1) ?? "";
      const known = name === "edgeware_v0" || name === "basic_v1";
      if (known) {
        lua_pushboolean(L, 1);
      } else {
        logger.warn(`[FengariVM] require("${name}") is not supported`);
        lua_pushnil(L);
      }
      return 1;
    });
    lua_setglobal(this.L, "require");

    // after(ms, callback). Node fires immediately for delays past the
    // signed 32-bit range, so a runaway delay is clamped to ~24 days.
    lua_pushcfunction(this.L, (L: number): number => {
      const raw = lua_tonumber(L, 1);
      const ms = Number.isFinite(raw) ? Math.min(2_147_483_647, Math.max(0, raw)) : 0;
      if (!lua_isfunction(L, 2)) return 0;
      const ref = vm.storeRef(2);
      const timer = setTimeout(() => {
        vm.timers.delete(timer);
        vm.invokeRef(ref);
      }, ms);
      vm.timers.add(timer);
      return 0;
    });
    lua_setglobal(this.L, "after");

    // roll(chance) — chance is a 0–100 percentage, like the legacy roll.
    lua_pushcfunction(this.L, (L: number): number => {
      const chance = lua_tonumber(L, 1);
      lua_pushboolean(L, Math.random() * 100 < chance ? 1 : 0);
      return 1;
    });
    lua_setglobal(this.L, "roll");

    // corrupt() — advance to the next corruption level.
    lua_pushcfunction(this.L, (): number => {
      vm.host?.corrupt();
      return 0;
    });
    lua_setglobal(this.L, "corrupt");

    // panic()
    lua_pushcfunction(this.L, (): number => {
      vm.host?.panic();
      return 0;
    });
    lua_setglobal(this.L, "panic");

    // close_popups()
    lua_pushcfunction(this.L, (): number => {
      vm.host?.closePopups();
      return 0;
    });
    lua_setglobal(this.L, "close_popups");

    // set_popup_close_text(text)
    lua_pushcfunction(this.L, (L: number): number => {
      const text = argString(L, 1);
      if (text) vm.host?.setPopupCloseText(text);
      return 0;
    });
    lua_setglobal(this.L, "set_popup_close_text");

    // image(filename?) — random pack image when nil.
    lua_pushcfunction(this.L, (L: number): number => {
      vm.host?.image(argString(L, 1));
      return 0;
    });
    lua_setglobal(this.L, "image");

    // video(filename?) — random pack video when nil.
    lua_pushcfunction(this.L, (L: number): number => {
      vm.host?.video(argString(L, 1));
      return 0;
    });
    lua_setglobal(this.L, "video");

    // audio(filename?, on_stop?) — on_stop fires when the audio popup closes.
    lua_pushcfunction(this.L, (L: number): number => {
      const file = argString(L, 1);
      const ref = lua_isfunction(L, 2) ? vm.storeRef(2) : null;
      vm.bindPopupRef(vm.host?.audio(file) ?? null, ref);
      return 0;
    });
    lua_setglobal(this.L, "audio");

    // prompt(text?, on_close?) — on_close fires when the prompt popup closes.
    lua_pushcfunction(this.L, (L: number): number => {
      const text = argString(L, 1);
      const ref = lua_isfunction(L, 2) ? vm.storeRef(2) : null;
      vm.bindPopupRef(vm.host?.prompt(text) ?? null, ref);
      return 0;
    });
    lua_setglobal(this.L, "prompt");

    // subliminal(text?) — legacy full-screen text popup.
    lua_pushcfunction(this.L, (L: number): number => {
      vm.host?.subliminal(argString(L, 1));
      return 0;
    });
    lua_setglobal(this.L, "subliminal");

    // web(url?) — random pack url when nil; opens in the system browser.
    lua_pushcfunction(this.L, (L: number): number => {
      vm.host?.web(argString(L, 1));
      return 0;
    });
    lua_setglobal(this.L, "web");

    // notification(text?) — random pack notification when nil.
    lua_pushcfunction(this.L, (L: number): number => {
      vm.host?.notification(argString(L, 1));
      return 0;
    });
    lua_setglobal(this.L, "notification");
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
