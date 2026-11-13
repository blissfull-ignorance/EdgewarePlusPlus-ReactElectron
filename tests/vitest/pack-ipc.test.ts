import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Mood state lives in the main-process module graph; vi.resetModules() gives
 * every test a fresh pack.ts (fresh, empty mood set). Moods are therefore set
 * through the registered pack:setActiveMoods handler — the same instance the
 * resolvers read, and the same path the renderer takes in production.
 */
async function setActiveMoods(moods: string[]): Promise<void> {
  await (handlers["pack:setActiveMoods"] as (e: unknown, m: unknown) => Promise<void>)({}, moods);
}

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

describe("pack IPC handlers", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    handlers = {};
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
    for (let i = 0; i < 20; i++) {
      const result = await (handler as () => Promise<string | null>)();
      expect(["image1.png", "image2.jpg"]).toContain(result);
    }
  });

  it.each(["pack:randomAudio", "pack:randomVideo"])(
    "%s returns null when the pack directory does not exist",
    async (channel) => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ packPath: "/mock/pack" }));
      mockExistsSync.mockReturnValue(false);

      const { registerHandlers } = await import("../../electron/ipc/pack");
      registerHandlers();

      const handler = handlers[channel];
      const result = await (handler as () => Promise<string | null>)();
      expect(result).toBeNull();
    }
  );

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

  it("randomPrompt reaches mood prompts only while the mood is active", async () => {
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

    // Locked: the mood prompt must never surface while inactive.
    for (let i = 0; i < 30; i++) {
      expect(await (handler as () => Promise<string | null>)()).toBe("Do as I say");
    }

    await setActiveMoods(["high"]);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add((await (handler as () => Promise<string | null>)())!);
    }
    expect(seen.has("Higher, slave")).toBe(true);
    expect(seen.has("Do as I say")).toBe(true);
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

    // The "high"-tagged url stays unreachable while the mood is inactive.
    for (let i = 0; i < 30; i++) {
      expect(await (handler as () => Promise<string | null>)()).toBe("https://a.example/page1");
    }

    await setActiveMoods(["high"]);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      seen.add((await (handler as () => Promise<string | null>)())!);
    }
    expect(seen.has("https://b.example/")).toBe(true);
    expect(seen.has("https://a.example/page1")).toBe(true);
  });

  it("repeated legacy reads never accumulate entries in the shipped default index", async () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes("index.json")) throw new Error("ENOENT");
      if (p.includes("web.json")) {
        return JSON.stringify({ urls: ["https://a.example/"], args: ["page1"], moods: [null] });
      }
      if (p.includes("config.json")) return JSON.stringify({ packPath: "/mock/pack" });
      throw new Error("ENOENT");
    });

    const { registerHandlers } = await import("../../electron/ipc/pack");
    registerHandlers();

    const loadInfo = handlers["pack:loadInfo"] as () => Promise<Record<string, unknown>>;
    for (let i = 0; i < 5; i++) {
      const info = await loadInfo();
      const web = (info?.default as { web?: unknown[] })?.web ?? [];
      // A shallow copy of DEFAULT_INDEX made every read push a second entry
      // into the shipped defaults — unbounded growth and mood dilution.
      expect(web).toHaveLength(1);
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
