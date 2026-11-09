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
  },
  app: {
    getPath: (key: string) => {
      if (key === "userData") return "/mock/user/data";
      if (key === "home") return "/mock/home";
      return "";
    },
  },
}));

describe("pack IPC handlers", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    handlers = {};
  });

  it("should register randomImage handler", async () => {
    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();
    expect(handlers["pack:randomImage"]).toBeDefined();
  });

  it("should register randomAudio handler", async () => {
    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();
    expect(handlers["pack:randomAudio"]).toBeDefined();
  });

  it("should register randomVideo handler", async () => {
    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();
    expect(handlers["pack:randomVideo"]).toBeDefined();
  });

  it("randomImage returns null when img directory does not exist", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockImplementation((p: string) => {
      if (p.endsWith("img")) return false;
      return true;
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomImage"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomImage returns null when no pack is loaded", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomImage"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomImage returns random file when img directory has images", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["image1.png", "image2.jpg", "readme.txt"]);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomImage"];
    const result = await (handler as () => Promise<string | null>)();
    expect(["image1.png", "image2.jpg"]).toContain(result);
  });

  it("randomAudio uses packDir variable consistently with existsSync guard", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockReturnValue(false);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomAudio"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
    expect(mockExistsSync).toHaveBeenCalled();
  });

  it("randomVideo uses packDir variable consistently with existsSync guard", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockReturnValue(false);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomVideo"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
    expect(mockExistsSync).toHaveBeenCalled();
  });

  it("closeLabel returns the modern index popupClose (pack-defined close text)", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) {
        return JSON.stringify({ default: { captions: [], prompts: [], popupClose: "I Submit <3" } });
      }
      return JSON.stringify({ packPath: "/mock/pack" });
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:closeLabel"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBe("I Submit <3");
  });

  it("closeLabel returns the legacy captions.json subtext when no index.json exists", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) throw new Error("ENOENT");
      if (p.includes("captions.json")) return JSON.stringify({ subtext: "Click to close!" });
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:closeLabel"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBe("Click to close!");
  });

  it("closeLabel falls back to the default 'I Submit <3' when the pack defines no label", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:closeLabel"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBe("I Submit <3");
  });

  it("closeLabel returns null when no pack is loaded", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:closeLabel"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomPrompt picks from default + mood prompts (legacy prompt.json)", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) throw new Error("ENOENT");
      if (p.includes("prompt.json")) {
        return JSON.stringify({ default: ["Do as I say"], moods: ["high"], high: ["Higher, slave"] });
      }
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomPrompt"];
    for (let i = 0; i < 20; i++) {
      const result = await (handler as () => Promise<string | null>)();
      expect(["Do as I say", "Higher, slave"]).toContain(result);
    }
  });

  it("randomPrompt returns null when the pack defines no prompts", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomPrompt"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomHypnoGif returns a subdir-qualified file from hypno/", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockImplementation((p: string) => p.endsWith("hypno"));
    mockReaddirSync.mockReturnValue(["obedience.gif", "other.png", "notes.txt"]);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomHypnoGif"];
    for (let i = 0; i < 10; i++) {
      const result = await (handler as () => Promise<string | null>)();
      expect(["hypno/obedience.gif", "hypno/other.png"]).toContain(result);
    }
  });

  it("randomHypnoGif falls back to the legacy subliminals/ dir", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockImplementation((p: string) => p.endsWith("subliminals"));
    mockReaddirSync.mockReturnValue(["old-spiral.gif"]);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomHypnoGif"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBe("subliminals/old-spiral.gif");
  });

  it("randomHypnoGif returns null when the pack has no hypno media", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
    mockExistsSync.mockReturnValue(false);

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomHypnoGif"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomWeb picks a url from the legacy web.json incl. mood urls", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) throw new Error("ENOENT");
      if (p.includes("web.json")) {
        return JSON.stringify({
          urls: ["https://a.example/", "https://b.example/"],
          args: ["page1", ""],
          moods: [null, "high"],
        });
      }
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomWeb"];
    for (let i = 0; i < 20; i++) {
      const result = await (handler as () => Promise<string | null>)();
      expect(["https://a.example/page1", "https://b.example/"]).toContain(result);
    }
  });

  it("randomWeb returns null when the pack defines no web urls", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomWeb"];
    const result = await (handler as () => Promise<string | null>)();
    expect(result).toBeNull();
  });

  it("randomPrompt joins pieces up to promptMaxLength when the index raises it", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) {
        // Modern index with a prompt sentence built from 2..3 pieces
        return JSON.stringify({
          default: {
            prompts: ["yes", "master"],
            promptMinLength: 2,
            promptMaxLength: 3,
          },
          moods: [],
        });
      }
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const handler = handlers["pack:randomPrompt"];
    for (let i = 0; i < 10; i++) {
      const result = await (handler as () => Promise<string | null>)();
      expect(result).not.toBeNull();
      const words = result!.split(" ");
      expect(words.length).toBeGreaterThanOrEqual(2);
      expect(words.length).toBeLessThanOrEqual(3);
      for (const word of words) {
        expect(["yes", "master"]).toContain(word);
      }
    }
  });
});
