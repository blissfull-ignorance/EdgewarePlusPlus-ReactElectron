import { describe, expect, it, vi, beforeEach } from "vitest";

let handlers: Record<string, (...args: unknown[]) => unknown> = {};

beforeEach(() => {
  handlers = {};
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
    getAllWindows: vi.fn(() => []),
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

describe("corruption IPC handlers — graceful degradation", () => {
  beforeEach(() => {
    handlers = {};
    (vi.mocked(vi.fn()).mockReset as () => void)?.();
  });

  it("getCurrentLevel returns 0 when no main window exists", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:getCurrentLevel"];
    expect(handler).toBeDefined();

    const result = await (handler as () => Promise<number>)();
    expect(result).toBe(0);
  });

  it("getNextLevelTime returns null when no main window exists", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:getNextLevelTime"];
    expect(handler).toBeDefined();

    const result = await (handler as () => Promise<number | null>)();
    expect(result).toBeNull();
  });

  it("applyLevelChanges does nothing when no main window exists", async () => {
    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const handler = handlers["corruption:applyLevelChanges"];
    expect(handler).toBeDefined();

    await expect(
      (handler as (...args: unknown[]) => Promise<void>)(
        {},
        { popupMod: 200 } as Record<string, unknown>
      )
    ).resolves.toBeUndefined();
  });

  it("applyLevelChanges rejects oversized payloads", async () => {
    const mockWin = {
      webContents: {
        executeJavaScript: vi.fn().mockResolvedValue(0),
      },
      isDestroyed: () => false,
    };

    const electronMock = vi.mocked(await import("electron"));
    (electronMock.BrowserWindow.getAllWindows as vi.Mock).mockReturnValue([mockWin]);

    const { registerHandlers } = await import("../../electron/ipc/corruption");
    registerHandlers();

    const hugePayload: Record<string, unknown> = {};
    hugePayload["data"] = "x".repeat(20000);

    const handler = handlers["corruption:applyLevelChanges"];
    await (handler as (...args: unknown[]) => Promise<void>)({}, hugePayload);

    expect(mockWin.webContents.executeJavaScript).not.toHaveBeenCalled();
  });
});
