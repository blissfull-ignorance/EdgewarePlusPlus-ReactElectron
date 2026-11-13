import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Fengari VM lifecycle and global-VM management. Actual script execution
 * is covered by lua-exec.test.ts, which runs real Lua.
 */
// @vitest-environment node

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  setLevel: vi.fn(),
};

vi.mock("../../electron/utils/logger", () => ({
  __esModule: true,
  get logger() {
    return mockLogger;
  },
}));

import { FengariVM, initLuaVM, getLuaVM, destroyLuaVM } from "../../electron/scripting/fengariAdapter";

describe("FengariVM lifecycle", () => {
  let vm: FengariVM;

  beforeEach(() => {
    vi.clearAllMocks();
    vm = new FengariVM();
  });

  it("constructing never throws", () => {
    expect(() => new FengariVM()).not.toThrow();
  });

  it("setCurrentLevel works regardless of initialization state", () => {
    vm.setCurrentLevel(5);
    expect(vm.getCurrentLevel()).toBe(5);
  });

  it("destroy clears the Lua state", () => {
    vm.destroy();
    expect(vm.initialized).toBe(false);
  });

  it("destroy is idempotent", () => {
    vm.destroy();
    expect(() => vm.destroy()).not.toThrow();
  });

  it("setCurrentLevel works after destroy", () => {
    vm.destroy();
    vm.setCurrentLevel(3);
    expect(vm.getCurrentLevel()).toBe(3);
  });

  it("exec fails cleanly after destroy", () => {
    vm.destroy();
    const r = vm.exec("return 1");
    expect(r.success).toBe(false);
    expect(r.error).toBe("Lua VM not initialized");
  });
});

describe("global VM management", () => {
  beforeEach(() => {
    destroyLuaVM();
  });

  it("initLuaVM creates and exposes the global VM", () => {
    const vm = initLuaVM();
    expect(getLuaVM()).toBe(vm);
  });

  it("destroyLuaVM nullifies the global VM", () => {
    initLuaVM();
    destroyLuaVM();
    expect(getLuaVM()).toBeNull();
  });

  it("getLuaVM returns null before initialization", () => {
    expect(getLuaVM()).toBeNull();
  });
});
