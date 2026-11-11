import { describe, expect, it, vi, beforeEach } from "vitest";

let handlers: Record<string, (...args: unknown[]) => unknown> = {};

beforeEach(() => {
  handlers = {};
  vi.resetModules();
});

const mockExistsSync = vi.fn();
const mockMkdir = vi.fn();
const mockReaddir = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFile = vi.fn();
const mockRename = vi.fn();
const mockRm = vi.fn();

vi.mock("fs", () => ({
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    promises: {
      mkdir: (...args: unknown[]) => mockMkdir(...args),
      readdir: (...args: unknown[]) => mockReaddir(...args),
      writeFile: (...args: unknown[]) => mockWriteFile(...args),
      rename: (...args: unknown[]) => mockRename(...args),
      rm: (...args: unknown[]) => mockRm(...args),
    },
  },
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
    on: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
  },
  app: {
    getPath: (key: string) => {
      if (key === "userData") return "/mock/user/data";
      return "";
    },
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

describe("system:saveSettings — error handling", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockMkdir.mockReset();
    mockWriteFile.mockReset();
    mockRename.mockReset();
    mockRm.mockReset().mockResolvedValue(undefined);
    handlers = {};
  });

  it("creates data directory automatically if missing before saving", async () => {
    mockExistsSync.mockReturnValue(false);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    const { registerHandlers } = await import("../../electron/ipc/system");
    registerHandlers();

    const handler = handlers["system:saveSettings"];
    expect(handler).toBeDefined();
    await (handler as (...args: unknown[]) => Promise<void>)(
      {},
      { popupMod: 100 } as Record<string, unknown>
    );

    expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFile).toHaveBeenCalled();
    // Config writes land atomically: temp file then rename over the target.
    expect(mockRename).toHaveBeenCalled();
  });

  it("throws error when writeFile fails (e.g. disk full)", async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockRejectedValue(new Error("ENOSPC: no space left on device"));

    const { registerHandlers } = await import("../../electron/ipc/system");
    registerHandlers();

    const handler = handlers["system:saveSettings"];
    await expect(
      (handler as (...args: unknown[]) => Promise<void>)(
        {},
        { popupMod: 100 } as Record<string, unknown>
      )
    ).rejects.toThrow("ENOSPC");
  });

  it("throws error when mkdir fails (e.g. permission denied)", async () => {
    mockExistsSync.mockReturnValue(false);
    mockMkdir.mockRejectedValue(new Error("EACCES: permission denied"));

    const { registerHandlers } = await import("../../electron/ipc/system");
    registerHandlers();

    const handler = handlers["system:saveSettings"];
    await expect(
      (handler as (...args: unknown[]) => Promise<void>)(
        {},
        { popupMod: 100 } as Record<string, unknown>
      )
    ).rejects.toThrow("EACCES");
  });
});
