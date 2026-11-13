import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildZip, buildRawZip } from "../zipFixtures";

// Module-scoped handles for the mocked ipcMain and per-test user data dir.
let handlers: Record<string, (...args: unknown[]) => unknown> = {};

vi.mock("electron", () => ({
  app: {
    getPath: (key: string) => {
      const base =
        (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA ??
        "/mock/user/data";
      return key === "userData" ? base : base;
    },
    isPackaged: false,
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
    on: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
  shell: {
    openPath: async (p: string) => {
      (globalThis as { __EWPP_TEST_OPENED?: string }).__EWPP_TEST_OPENED = p;
      return "";
    },
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
  Tray: class Tray {},
  Menu: class Menu {},
  Notification: class Notification {},
}));

describe("system IPC handlers (pack import / discovery / selection)", () => {
  let tempRoot: string;

  beforeAll(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "ewpp-system-ipc-"));
    (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA = tempRoot;
  });

  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    delete (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA;
  });

  beforeEach(async () => {
    handlers = {};
    vi.resetModules();
    const { registerHandlers } = await import("../../electron/ipc/system");
    registerHandlers();
  });

  const configPath = () => path.join(tempRoot, "data", "config.json");
  const libraryPath = () => path.join(tempRoot, "data", "packs");

  it("lists seeded packs with info.json metadata from the canonical library", async () => {
    const packDir = path.join(libraryPath(), "My Pack");
    mkdirSync(packDir, { recursive: true });
    writeFileSync(
      path.join(packDir, "info.json"),
      JSON.stringify({ name: "My Pack Info", version: "1.2", creator: "Dev" })
    );

    const result = await handlers["system:listPacks"]();
    const found = (result as { path: string }[]).find(
      (p) => p.path === packDir
    );
    expect(found).toBeTruthy();
    expect(found!.name).toBe("My Pack Info");
    expect(found!.version).toBe("1.2");
    expect(found!.creator).toBe("Dev");
  });

  it("falls back to the directory name when info.json is missing", async () => {
    const packDir = path.join(libraryPath(), "bare-pack");
    mkdirSync(packDir, { recursive: true });

    const result = await handlers["system:listPacks"]();
    const found = (result as { path: string; name: string; version?: string }[]).find(
      (p) => p.path === packDir
    );
    expect(found).toBeTruthy();
    expect(found!.name).toBe("bare-pack");
    expect(found!.version).toBeUndefined();
  });

  it("includes user-added pack folders persisted in config.json", async () => {
    const sidePack = path.join(tempRoot, "elsewhere", "Side Pack");
    mkdirSync(sidePack, { recursive: true });
    writeFileSync(
      path.join(sidePack, "info.json"),
      JSON.stringify({ name: "Side Pack Info", version: "9.9" })
    );
    mkdirSync(path.join(tempRoot, "data"), { recursive: true });
    writeFileSync(configPath(), JSON.stringify({ packFolders: [sidePack] }));

    const result = await handlers["system:listPacks"]();
    const found = (result as { path: string; name: string }[]).find(
      (p) => p.path === sidePack
    );
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Side Pack Info");
  });

  it("extracts a real zip into the canonical library (D-19 destination)", async () => {
    const uploads = path.join(tempRoot, "uploads");
    mkdirSync(uploads, { recursive: true });
    const zipPath = path.join(uploads, "my-pack.zip");
    const image = Buffer.from("PNG-BYTES-1234");
    await buildZip(zipPath, {
      "info.json": JSON.stringify({ name: "Real Pack", version: "3.0", creator: "Ar" }),
      "img/seed.png": image,
    });

    const result = await handlers["system:importPack"]({}, zipPath);

    expect(result.path).toBe(path.join(libraryPath(), "my-pack"));
    expect(readFileSync(path.join(result.path, "info.json"), "utf-8")).toBe(
      JSON.stringify({ name: "Real Pack", version: "3.0", creator: "Ar" })
    );
    expect(readFileSync(path.join(result.path, "img/seed.png"))).toEqual(image);
    expect(result.name).toBe("Real Pack");
    expect(result.version).toBe("3.0");
  });

  it("imports the same zip twice as <name> (2) instead of overwriting", async () => {
    const uploads = path.join(tempRoot, "uploads");
    mkdirSync(uploads, { recursive: true });
    const zipPath = path.join(uploads, "twice.zip");
    await buildZip(zipPath, { "info.json": JSON.stringify({ name: "Twice" }) });

    const first = await handlers["system:importPack"]({}, zipPath);
    const second = await handlers["system:importPack"]({}, zipPath);
    expect(first.path).toBe(path.join(libraryPath(), "twice"));
    expect(second.path).toBe(path.join(libraryPath(), "twice (2)"));
    expect(existsSync(path.join(second.path, "info.json"))).toBe(true);
  });

  it("unwraps zips nested one directory deep during import", async () => {
    const uploads = path.join(tempRoot, "uploads");
    mkdirSync(uploads, { recursive: true });
    const zipPath = path.join(uploads, "nested.zip");
    await buildZip(zipPath, {
      "Nested Dir/info.json": JSON.stringify({ name: "Nested Import" }),
      "Nested Dir/img/x.png": Buffer.from("PNG"),
    });

    const result = await handlers["system:importPack"]({}, zipPath);
    expect(result.path).toBe(path.join(libraryPath(), "nested"));
    expect(existsSync(path.join(result.path, "info.json"))).toBe(true);
    expect(existsSync(path.join(result.path, "Nested Dir"))).toBe(false);
  });

  it("rejects a traversal zip with a visible error and writes nothing outside", async () => {
    const uploads = path.join(tempRoot, "uploads");
    mkdirSync(uploads, { recursive: true });
    const zipPath = path.join(uploads, "evil.zip");
    buildRawZip(zipPath, [
      { name: "../../escape.txt", data: Buffer.from("escaped") },
      { name: "inner.txt", data: Buffer.from("inner") },
    ]);

    await expect(handlers["system:importPack"]({}, zipPath)).rejects.toThrow(
      /unsafe archive entry/i
    );
    expect(existsSync(path.join(tempRoot, "escape.txt"))).toBe(false);
    expect(existsSync(path.join(tempRoot, "data", "escape.txt"))).toBe(false);
    expect(existsSync(path.join(libraryPath(), "evil"))).toBe(false);
  });

  it("rejects a non-zip file with a visible error", async () => {
    const uploads = path.join(tempRoot, "uploads");
    mkdirSync(uploads, { recursive: true });
    const garbage = path.join(uploads, "garbage.zip");
    writeFileSync(garbage, "not a zip at all");

    await expect(handlers["system:importPack"]({}, garbage)).rejects.toThrow(
      /Not a valid zip file/i
    );
  });

  it("rejects a missing file with a visible error", async () => {
    await expect(
      handlers["system:importPack"]({}, path.join(tempRoot, "nope.zip"))
    ).rejects.toThrow(/not found/i);
  });

  it("rejects an empty import path instead of silently doing nothing", async () => {
    await expect(handlers["system:importPack"]({}, "")).rejects.toThrow(
      /No file path was provided/i
    );
  });

  it("selectZip honors the deterministic test seam instead of a dialog", async () => {
    process.env.EDGWARE_IMPORT_TEST_PATH = path.join(tempRoot, "seam.zip");
    try {
      const result = await handlers["system:selectZip"]();
      expect(result).toEqual({
        cancelled: false,
        filePaths: [path.join(tempRoot, "seam.zip")],
      });
    } finally {
      delete process.env.EDGWARE_IMPORT_TEST_PATH;
    }
  });

  it("selectPackFolder honors the deterministic test seam", async () => {
    const folder = path.join(tempRoot, "seam-folder");
    process.env.EDGWARE_PACK_FOLDER_TEST_PATH = folder;
    try {
      const result = await handlers["system:selectPackFolder"]();
      expect(result).toEqual({ cancelled: false, folderPath: folder });
    } finally {
      delete process.env.EDGWARE_PACK_FOLDER_TEST_PATH;
    }
  });

  it("validatePackFolder accepts folders with a manifest", async () => {
    const folder = path.join(tempRoot, "valid-pack");
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      path.join(folder, "info.json"),
      JSON.stringify({ name: "Valid Pack", version: "2.1", creator: "V" })
    );
    const result = await handlers["system:validatePackFolder"](
      {},
      folder
    );
    expect(result.ok).toBe(true);
    expect(result.name).toBe("Valid Pack");
    expect(result.version).toBe("2.1");
    expect(result.warning).toBeUndefined();
  });

  it("validatePackFolder warns (but accepts) folders without a manifest", async () => {
    const folder = path.join(tempRoot, "manifest-less");
    mkdirSync(folder, { recursive: true });
    const result = await handlers["system:validatePackFolder"]({}, folder);
    expect(result.ok).toBe(true);
    expect(result.name).toBe("manifest-less");
    expect(result.warning).toMatch(/info\.json or index\.json/);
  });

  it("validatePackFolder rejects missing locations", async () => {
    const result = await handlers["system:validatePackFolder"](
      {},
      path.join(tempRoot, "does-not-exist")
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not exist/i);
  });

  it("openPackLibrary opens the canonical library folder", async () => {
    delete (globalThis as { __EWPP_TEST_OPENED?: string }).__EWPP_TEST_OPENED;
    await handlers["system:openPackLibrary"]();
    expect((globalThis as { __EWPP_TEST_OPENED?: string }).__EWPP_TEST_OPENED).toBe(
      libraryPath()
    );
    expect(existsSync(libraryPath())).toBe(true);
  });

  it("loadSettings reads config.json from the user data dir", async () => {
    mkdirSync(path.join(tempRoot, "data"), { recursive: true });
    writeFileSync(configPath(), JSON.stringify({ popupMod: 42 }));
    const result = await handlers["system:loadSettings"]();
    expect(result).toEqual({ popupMod: 42 });
  });

  it("saveSettings writes config.json into the user data dir", async () => {
    await handlers["system:saveSettings"]({}, { popupMod: 80, themeType: "Dark" });
    const written = JSON.parse(readFileSync(configPath(), "utf-8"));
    expect(written).toEqual({ popupMod: 80, themeType: "Dark" });
  });

  it("loadSettings resolves null for a corrupt config.json", async () => {
    mkdirSync(path.join(tempRoot, "data"), { recursive: true });
    writeFileSync(configPath(), "{oops");
    expect(await handlers["system:loadSettings"]()).toBeNull();
  });

  it("saveSettings refuses payloads that are not settings objects", async () => {
    mkdirSync(path.dirname(configPath()), { recursive: true });
    rmSync(configPath(), { force: true });
    await handlers["system:saveSettings"]({}, "garbage");
    expect(existsSync(configPath())).toBe(false);
    await handlers["system:saveSettings"]({}, [1, 2, 3]);
    expect(existsSync(configPath())).toBe(false);

    // An existing config must survive a rejected write unchanged.
    writeFileSync(configPath(), JSON.stringify({ popupMod: 42 }));
    await handlers["system:saveSettings"]({}, null);
    expect(JSON.parse(readFileSync(configPath(), "utf-8"))).toEqual({ popupMod: 42 });
  });
});
