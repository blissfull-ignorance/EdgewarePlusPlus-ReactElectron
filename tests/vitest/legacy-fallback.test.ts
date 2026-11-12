import { describe, expect, it, vi, beforeEach } from "vitest";

// Module-scoped handler capture
let handlers: Record<string, (...args: unknown[]) => unknown> = {};

// ── Shared mock factory ──

/** Build a mock fs module from a set of virtual files keyed by path suffix. */
function buildFsMock(files: Record<string, string | null>) {
  const existsSync = vi.fn((p: string) => {
    const key = p.replace(/\\/g, "/");
    for (const fileKey of Object.keys(files)) {
      if (key.endsWith(fileKey)) return files[fileKey] !== null;
    }
    return false;
  });

  const readdirSync = vi.fn(() => Object.keys(files).filter((k) => files[k] !== null));

  const readFileSync = vi.fn((p: string) => {
    const key = p.replace(/\\/g, "/");
    for (const fileKey of Object.keys(files)) {
      if (key.endsWith(fileKey)) {
        const content = files[fileKey];
        if (content === null) throw new Error("ENOENT");
        return content;
      }
    }
    throw new Error("ENOENT");
  });

  return { existsSync, readdirSync, readFileSync };
}

// ── Legacy test data ──

const LEGACY_CAPTIONS = {
  prefix: ["mood_a", "mood_b", "default"],
  default: ["Default caption 1", "Default caption 2"],
  mood_a: ["Mood A caption"],
  mood_b: ["Mood B caption 1", "Mood B caption 2"],
  denial: ["Denied!"],
  subliminals: ["You are mine"],
  notifications: ["System notification"],
  subtext: "Click to submit",
  prefix_settings: {
    mood_a: { max: 3 },
    mood_b: { max: 2 },
  },
};

const LEGACY_PROMPTS = {
  moods: ["default", "mood_x", "mood_y"],
  freqList: [50, 30, 20],
  minLen: 3,
  maxLen: 20,
  subtext: "Type the answer",
  commandtext: "What is your name?",
  default: ["default prompt 1", "default prompt 2"],
  mood_x: ["prompt for x"],
  mood_y: ["prompt for y 1", "prompt for y 2"],
};

const LEGACY_WEB = {
  urls: ["https://example.com", "https://test.com/page", "https://moodz.com"],
  args: ["arg1,arg2", "arg3", "arg4,arg5,arg6"],
  moods: ["default", null, "mood_z"],
};

const LEGACY_MEDIA = {
  mood_alpha: ["alpha1.png", "alpha2.jpg", "alpha3.gif"],
  mood_beta: ["beta1.png"],
  default: ["default1.png", "default2.jpg"],
};

// ── Test helper: run a pack:loadIndex test with given virtual files ──

async function testLoadIndex(files: Record<string, string | null>) {
  vi.resetModules();
  handlers = {};

  const { existsSync, readdirSync, readFileSync } = buildFsMock(files);

  vi.doMock("electron", () => ({
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

  vi.doMock("node:fs", () => ({
    default: { existsSync, readdirSync, readFileSync },
    existsSync,
    readdirSync,
    readFileSync,
  }));

  const { registerHandlers } = await import("../../electron/ipc/pack");
  registerHandlers();

  const handler = handlers["pack:loadIndex"];
  if (!handler) throw new Error("pack:loadIndex handler not registered");
  return handler();
}

// ── Tests ──

describe("Legacy fallback pack format parsing via pack:loadIndex IPC", () => {
  beforeEach(() => {
    vi.resetModules();
    handlers = {};
  });

  it("returns null when no pack is loaded", async () => {
    const result = await testLoadIndex({});
    expect(result).toBeNull();
  });

  it("returns modern Index when index.json exists, ignoring legacy files", async () => {
    const modernIndex = {
      default: {
        maxClicks: 1,
        captions: ["MODERN CAPTION"],
        denial: [],
        subliminals: [],
        notifications: [],
        prompts: [],
        web: [],
        popupClose: "MODERN",
        promptCommand: "Type",
        promptSubmit: "Submit",
        promptMinLength: 1,
        promptMaxLength: 1,
      },
      moods: [
        {
          mood: "happy",
          maxClicks: 1,
          captions: ["Happy caption"],
          denial: [],
          subliminals: [],
          notifications: [],
          prompts: [],
          web: [],
          media: ["happy.png"],
        },
      ],
    };

    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "index.json": JSON.stringify(modernIndex),
      "captions.json": JSON.stringify(LEGACY_CAPTIONS),
      "prompt.json": JSON.stringify(LEGACY_PROMPTS),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;

    const moods = index.moods as Record<string, unknown>[];
    expect(Array.isArray(moods)).toBe(true);
    expect(moods).toHaveLength(1);
    expect(moods[0].name).toBe("happy");
    expect(moods[0].captions).toEqual(["Happy caption"]);

    const def = index.default as Record<string, unknown>;
    expect(def.captions).toEqual(["MODERN CAPTION"]);
    expect(def.popupClose).toBe("MODERN");
  });

  it("parses captions.json into Index with captions, denial, subliminals, notifications", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "captions.json": JSON.stringify(LEGACY_CAPTIONS),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;

    const def = index.default as Record<string, unknown>;
    expect(def.captions).toEqual(["Default caption 1", "Default caption 2"]);
    expect(def.denial).toEqual(["Denied!"]);
    expect(def.subliminals).toEqual(["You are mine"]);
    expect(def.notifications).toEqual(["System notification"]);
    expect(def.popupClose).toBe("Click to submit");

    const moods = index.moods as Record<string, unknown>[];
    expect(moods.length).toBeGreaterThanOrEqual(2);

    const moodA = moods.find((m) => m.name === "mood_a");
    expect(moodA).toBeDefined();
    expect(moodA?.captions).toEqual(["Mood A caption"]);
    expect(moodA?.maxClicks).toBe(3);

    const moodB = moods.find((m) => m.name === "mood_b");
    expect(moodB).toBeDefined();
    expect(moodB?.captions).toEqual(["Mood B caption 1", "Mood B caption 2"]);
    expect(moodB?.maxClicks).toBe(2);
  });

  it("parses prompt.json into Index with prompts and default settings", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "prompt.json": JSON.stringify(LEGACY_PROMPTS),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;

    const def = index.default as Record<string, unknown>;
    expect(def.prompts).toEqual(["default prompt 1", "default prompt 2"]);
    expect(def.promptSubmit).toBe("Type the answer");
    expect(def.promptCommand).toBe("What is your name?");
    expect(def.promptMinLength).toBe(3);
    expect(def.promptMaxLength).toBe(20);

    const moods = index.moods as Record<string, unknown>[];
    const moodX = moods.find((m) => m.name === "mood_x");
    expect(moodX).toBeDefined();
    expect(moodX?.prompts).toEqual(["prompt for x"]);

    const moodY = moods.find((m) => m.name === "mood_y");
    expect(moodY).toBeDefined();
    expect(moodY?.prompts).toEqual(["prompt for y 1", "prompt for y 2"]);
  });

  it("parses web.json into Index with web URLs mapped to moods", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "web.json": JSON.stringify(LEGACY_WEB),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;

    const def = index.default as Record<string, unknown>;
    const defaultWeb = def.web as { url: string; args: string[] }[];
    expect(defaultWeb).toContainEqual({ url: "https://example.com", args: ["arg1", "arg2"] });
    expect(defaultWeb).toContainEqual({ url: "https://test.com/page", args: ["arg3"] });

    const moods = index.moods as Record<string, unknown>[];
    const moodZ = moods.find((m) => m.name === "mood_z");
    expect(moodZ).toBeDefined();
    const moodZWeb = moodZ?.web as { url: string; args: string[] }[];
    expect(moodZWeb).toContainEqual({ url: "https://moodz.com", args: ["arg4", "arg5", "arg6"] });
  });

  it("parses media.json into mediaMoods mapping, excluding 'default' mood files", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "media.json": JSON.stringify(LEGACY_MEDIA),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;

    const mediaMoods = index.mediaMoods as Record<string, string[]>;
    expect(mediaMoods["alpha1.png"]).toEqual(["mood_alpha"]);
    expect(mediaMoods["alpha2.jpg"]).toEqual(["mood_alpha"]);
    expect(mediaMoods["alpha3.gif"]).toEqual(["mood_alpha"]);
    expect(mediaMoods["beta1.png"]).toEqual(["mood_beta"]);
    expect(mediaMoods["default1.png"]).toBeUndefined();
    expect(mediaMoods["default2.jpg"]).toBeUndefined();
  });

  it("handles pack with NO manifest files gracefully returning default Index", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;
    expect(Array.isArray(index.moods)).toBe(true);
  });

  it("handles malformed captions.json gracefully without crashing", async () => {
    const result = await testLoadIndex({
      "config.json": JSON.stringify({ packPath: "/mock/pack" }),
      "captions.json": "not valid json!!!",
    });

    expect(result).not.toBeNull();
    const index = result as Record<string, unknown>;
    expect(Array.isArray(index.moods)).toBe(true);
  });
});

describe("Desktop notification IPC via system:sendNotification", () => {
  let notificationInstance: Record<string, unknown> | null = null;

  beforeEach(() => {
    vi.resetModules();
    handlers = {};
    notificationInstance = null;
  });

  it("system:sendNotification handler is registered and sends notification", async () => {
    const MockNotification = vi.fn().mockImplementation(function (opts: Record<string, unknown>) {
      notificationInstance = {
        ...opts,
        show: vi.fn(),
        close: vi.fn(),
      };
      return notificationInstance;
    });

    vi.doMock("electron", () => ({
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
        getAppPath: () => "/mock/app",
        dock: undefined,
      },
      Notification: MockNotification,
      Tray: vi.fn(),
      Menu: { buildFromTemplate: vi.fn().mockReturnValue({}) },
      BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) },
    }));

    vi.doMock("fs", () => ({
      default: {
        existsSync: vi.fn().mockReturnValue(false),
        promises: {
          mkdir: vi.fn().mockResolvedValue(undefined),
          writeFile: vi.fn().mockResolvedValue(undefined),
        },
        readFileSync: vi.fn().mockImplementation(() => { throw new Error("ENOENT"); }),
      },
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockImplementation(() => { throw new Error("ENOENT"); }),
      promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.doMock("child_process", () => ({
      __esModule: true,
      default: { exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => cb(null, "", "")) },
      exec: vi.fn((_cmd: string, cb: (...args: unknown[]) => void) => cb(null, "", "")),
    }));

    vi.doMock("util", () => ({
      __esModule: true,
      default: { promisify: vi.fn((fn: (...args: unknown[]) => unknown) => fn) },
      promisify: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    }));

    const { registerHandlers } = await import("../../electron/ipc/system");
    registerHandlers();

    expect(handlers["system:sendNotification"]).toBeDefined();

    const handler = handlers["system:sendNotification"];
    await (handler as (...args: unknown[]) => Promise<void>)(
      {},
      "Test Title",
      "Test Message"
    );

    expect(MockNotification).toHaveBeenCalled();
    expect(notificationInstance).not.toBeNull();
    if (notificationInstance) {
      expect(notificationInstance.title).toBe("Test Title");
      expect(notificationInstance.body).toBe("Test Message");
    }
  });
});
