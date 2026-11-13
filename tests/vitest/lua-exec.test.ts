import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * Real Lua execution through the Fengari bridge: the VM initializes in the
 * test environment, so these pin actual script behaviour — the class of the
 * historical "no script could ever load" regression.
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

import { FengariVM } from "../../electron/scripting/fengariAdapter";
import type { EdgewareHost } from "../../electron/scripting/fengariAdapter";

function stubHost(): EdgewareHost {
  return {
    corrupt: vi.fn(),
    panic: vi.fn(),
    closePopups: vi.fn(),
    setPopupCloseText: vi.fn(),
    image: vi.fn(() => "popup-id"),
    video: vi.fn(() => null),
    audio: vi.fn(() => null),
    prompt: vi.fn(() => null),
    subliminal: vi.fn(() => null),
    web: vi.fn(),
    notification: vi.fn(),
  };
}

describe("FengariVM real execution", () => {
  let vm: FengariVM;

  beforeEach(() => {
    vm = new FengariVM();
  });

  afterEach(() => {
    vm.destroy();
  });

  it("runs arithmetic and returns the value", () => {
    const r = vm.exec("return 2 * 21");
    expect(r.success).toBe(true);
    expect(r.returnValue).toBe(42);
  });

  it("returns strings and booleans", () => {
    expect(vm.exec('return "hello"').returnValue).toBe("hello");
    expect(vm.exec("return true").returnValue).toBe(true);
  });

  it("reports syntax errors as load failures without touching the VM", () => {
    const r = vm.exec("this is not lua");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Load error/);
    expect(vm.exec("return 7").returnValue).toBe(7);
  });

  it("reports runtime errors with the Lua message", () => {
    const r = vm.exec('error("boom")');
    expect(r.success).toBe(false);
    expect(r.error).toContain("boom");
  });

  it(
    "interrupts an infinite loop within the budget and stays usable",
    () => {
      const started = Date.now();
      const r = vm.exec("while true do end");
      expect(Date.now() - started).toBeLessThan(10_000);
      expect(r.success).toBe(false);
      expect(vm.exec("return 1").returnValue).toBe(1);
    },
    15_000
  );

  it("keeps the stack clean across repeated returns", () => {
    for (let i = 0; i < 60; i++) {
      expect(vm.exec(`return ${i}`).returnValue).toBe(i);
    }
    expect(vm.exec("return 'clean'").returnValue).toBe("clean");
  });

  it("routes edgeware_v0 globals through the host", () => {
    const host = stubHost();
    vm.setHost(host);
    const r = vm.exec('require("edgeware_v0")\nimage("x.png")\nnotification("hi")\ncorrupt()');
    expect(r.success).toBe(true);
    expect(host.image).toHaveBeenCalledWith("x.png");
    expect(host.notification).toHaveBeenCalledWith("hi");
    expect(host.corrupt).toHaveBeenCalled();
    vm.setHost(null);
  });

  it("roll() is deterministic at the extremes", () => {
    expect(vm.exec('require("edgeware_v0")\nreturn roll(100)').returnValue).toBe(true);
    expect(vm.exec('require("edgeware_v0")\nreturn roll(0)').returnValue).toBe(false);
  });

  it("answers unknown require() names with nil and a warning", () => {
    const r = vm.exec('return require("not_a_pack_module")');
    expect(r.success).toBe(true);
    expect(r.returnValue).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('require("not_a_pack_module")'));
  });
});
