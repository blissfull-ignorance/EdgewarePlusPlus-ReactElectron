import { describe, expect, it, vi, beforeEach } from "vitest";

let handlers: Record<string, (...args: unknown[]) => unknown> = {};

beforeEach(() => {
  handlers = {};
  vi.resetModules();
});

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
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
      if (key === "home") return "/mock/home";
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

describe("pack:loadIndex — corrupt JSON handling", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    handlers = {};
  });

  it("handles completely corrupt index.json (returns DEFAULT_INDEX, does not crash)", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("config.json")) {
        return JSON.stringify({ packPath: "/mock/pack" });
      }
      return "THIS IS NOT VALID JSON {{{";
    });
    mockExistsSync.mockReturnValue(true);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:loadIndex"];
    expect(handler).toBeDefined();

    const result = await (handler as () => Promise<Record<string, unknown> | null>)();
    expect(result).not.toBeNull();
    const res = result as Record<string, unknown>;
    expect(res.default).toBeDefined();
    expect(Array.isArray(res.moods)).toBe(true);
  });

  it("loadInfo falls back to the default index when the pack ships no manifests", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("config.json")) {
        return JSON.stringify({ packPath: "/mock/pack" });
      }
      throw new Error("ENOENT: no such file");
    });
    // The pack directory exists; every manifest inside it does not.
    mockExistsSync.mockImplementation((p: string) => p === "/mock/pack");

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:loadInfo"];
    const result = await (handler as () => Promise<Record<string, unknown> | null>)();
    // Contract: an existing pack without readable manifests yields the
    // built-in default Index (non-null, moods array), never a throw.
    expect(result).not.toBeNull();
    expect(Array.isArray(result?.moods)).toBe(true);
  });

  it.each(["pack:randomImage", "pack:randomAudio", "pack:randomVideo", "pack:randomPrompt", "pack:randomWeb"])(
    "%s survives a readdir failure with null",
    async (channel) => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const { registerHandlers } = await import("../../electron/ipc/pack");
      registerHandlers();

      const handler = handlers[channel];
      expect(handler).toBeDefined();
      const result = await (handler as () => Promise<string | null>)();
      expect(result).toBeNull();
    }
  );
});
