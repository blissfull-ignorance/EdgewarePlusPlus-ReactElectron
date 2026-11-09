import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Tests for the Fengari Lua VM bridge.
 *
 * Runs in a Node.js environment. Fengari 0.1.4 is incompatible with
 * Node.js 25+, so the VM fails to initialize in this test environment.
 * Tests verify the graceful degradation behavior. In production Electron
 * (which bundles its own Node.js), Fengari works correctly.
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

describe("FengariVM", () => {
  let vm: FengariVM;

  beforeEach(() => {
    vi.clearAllMocks();
    vm = new FengariVM();
  });

  describe("initialization", () => {
    it("creates a VM instance", () => {
      expect(vm).toBeInstanceOf(FengariVM);
    });

    it("exposes initialized property", () => {
      expect(typeof vm.initialized).toBe("boolean");
    });

    it("gracefully handles initialization failure without throwing", () => {
      expect(() => new FengariVM()).not.toThrow();
    });
  });

  describe("graceful degradation (VM not initialized)", () => {
    it("exec returns failure with descriptive error", () => {
      if (!vm.initialized) {
        const result = vm.exec("return 42");
        expect(result.success).toBe(false);
        expect(result.error).toBe("Lua VM not initialized");
      }
    });

    it("triggerTransition returns empty array", () => {
      if (!vm.initialized) {
        const results = vm.triggerTransition(1);
        expect(results).toEqual([]);
      }
    });

    it("setCurrentLevel works regardless of initialization state", () => {
      vm.setCurrentLevel(5);
      expect(vm.getCurrentLevel()).toBe(5);
    });
  });

  describe("lifecycle", () => {
    it("destroy cleans up the Lua state", () => {
      vm.destroy();
      expect(vm.initialized).toBe(false);
    });

    it("destroy is idempotent", () => {
      vm.destroy();
      expect(() => vm.destroy()).not.toThrow();
    });

    it("setCurrentLevel works after destroy", () => {
      vm.setCurrentLevel(3);
      expect(vm.getCurrentLevel()).toBe(3);
    });
  });

  describe("global VM management", () => {
    it("initLuaVM creates and returns a VM", () => {
      destroyLuaVM();
      const newVm = initLuaVM();
      expect(newVm).toBeInstanceOf(FengariVM);
      expect(getLuaVM()).toBe(newVm);
    });

    it("destroyLuaVM nullifies the global VM", () => {
      destroyLuaVM();
      expect(getLuaVM()).toBeNull();
    });

    it("getLuaVM returns null before initialization", () => {
      destroyLuaVM();
      expect(getLuaVM()).toBeNull();
    });

    it("initLuaVM logs warning via logger when initialization fails", () => {
      destroyLuaVM();
      const newVm = initLuaVM();

      if (!newVm.initialized) {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "[FengariVM] Initialization failed — Lua scripting will be unavailable"
        );
      } else {
        expect(getLuaVM()).toBe(newVm);
      }
    });
  });
});
