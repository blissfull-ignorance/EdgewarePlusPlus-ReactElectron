import { describe, expect, it, vi, beforeEach } from "vitest";

let handlers: Record<string, (...args: unknown[]) => unknown> = {};
let windows: unknown[] = [];

beforeEach(() => {
  handlers = {};
  windows = [];
  vi.resetModules();
});

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
    on: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
  },
  BrowserWindow: {
    getAllWindows: () => windows,
  },
}));

vi.mock("../../electron/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
  },
}));

function mockWindow() {
  const win = {
    webContents: { send: vi.fn() },
    isDestroyed: () => false,
  };
  windows = [win];
  return win;
}

describe("corruption IPC handlers", () => {
  it("getCurrentLevel reports 0 before any level is published", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:getCurrentLevel"];
    expect(await (handler as () => Promise<number>)()).toBe(0);
  });

  it("getNextLevelTime reports null before any level is published", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:getNextLevelTime"];
    expect(await (handler as () => Promise<number | null>)()).toBeNull();
  });

  it("applyLevelChanges does nothing when no main window exists", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:applyLevelChanges"];
    await expect(
      (handler as (...args: unknown[]) => Promise<void>)({}, { popupMod: 200 })
    ).resolves.toBeUndefined();
  });

  it("applyLevelChanges relays a small payload to the renderer", async () => {
    const win = mockWindow();
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:applyLevelChanges"];
    await (handler as (...args: unknown[]) => Promise<void>)({}, { popupMod: 200 });

    expect(win.webContents.send).toHaveBeenCalledWith(
      "corruption:applyChanges",
      { popupMod: 200 }
    );
  });

  it("applyLevelChanges silently drops oversized payloads", async () => {
    const win = mockWindow();
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const hugePayload: Record<string, unknown> = { data: "x".repeat(20000) };
    const handler = handlers["corruption:applyLevelChanges"];
    await expect(
      (handler as (...args: unknown[]) => Promise<void>)({}, hugePayload)
    ).resolves.toBeUndefined();

    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it("injectLevel rejects non-numeric and sub-1 levels without broadcasting", async () => {
    const win = mockWindow();
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const inject = handlers["corruption:injectLevel"] as (...a: unknown[]) => boolean;
    const current = handlers["corruption:getCurrentLevel"] as () => Promise<number>;

    expect(inject({}, "abc")).toBe(false);
    expect(inject({}, NaN)).toBe(false);
    expect(inject({}, 0)).toBe(false);
    expect(inject({}, -3)).toBe(false);
    expect(win.webContents.send).not.toHaveBeenCalled();
    expect(await current()).toBe(0);
  });

  it("injectLevel floors fractions and broadcasts the integer level", async () => {
    const win = mockWindow();
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const inject = handlers["corruption:injectLevel"] as (...a: unknown[]) => boolean;
    const current = handlers["corruption:getCurrentLevel"] as () => Promise<number>;

    expect(inject({}, 3.7)).toBe(true);
    expect(await current()).toBe(3);
    expect(win.webContents.send).toHaveBeenCalledWith("corruption:inject", 3);
  });

  it("injectLevel refuses absurd levels beyond the hard ceiling", async () => {
    const win = mockWindow();
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const inject = handlers["corruption:injectLevel"] as (...a: unknown[]) => boolean;
    const current = handlers["corruption:getCurrentLevel"] as () => Promise<number>;

    expect(inject({}, 1e9)).toBe(false);
    expect(await current()).toBe(0);
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it("setLevel sanitizes non-finite input to 0 and stores the next time", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const setLevel = handlers["corruption:setLevel"] as (...a: unknown[]) => void;
    const current = handlers["corruption:getCurrentLevel"] as () => Promise<number>;
    const nextTime = handlers["corruption:getNextLevelTime"] as () => Promise<number | null>;

    setLevel({}, NaN, 5000);
    expect(await current()).toBe(0);
    expect(await nextTime()).toBe(5000);

    setLevel({}, 4, null);
    expect(await current()).toBe(4);
    expect(await nextTime()).toBeNull();
  });
});
