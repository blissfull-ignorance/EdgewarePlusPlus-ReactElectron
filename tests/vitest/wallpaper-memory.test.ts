import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("electron", () => ({
  app: {
    getPath: () =>
      (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA ?? "/mock",
  },
}));

vi.mock("../../electron/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../electron/utils/wallpaper", () => ({
  getWallpaper: vi.fn(),
  setWallpaper: vi.fn(),
}));

import { applyWallpaper, restoreWallpaperIfDirty } from "../../electron/utils/wallpaperMemory";
import { invalidateConfigCache } from "../../electron/utils/configCache";
import { getWallpaper, setWallpaper } from "../../electron/utils/wallpaper";

const getMock = vi.mocked(getWallpaper);
const setMock = vi.mocked(setWallpaper);

interface State {
  original: string;
  dirty: boolean;
  applied?: string[];
}

function readState(): State | null {
  try {
    return JSON.parse(readFileSync(path.join(userRoot, "wallpaper_state.json"), "utf-8")) as State;
  } catch {
    return null;
  }
}

function writeState(state: State): void {
  writeFileSync(path.join(userRoot, "wallpaper_state.json"), JSON.stringify(state), "utf-8");
}

// Applied paths are stored path.resolve()-normalized; assertions compare on
// the same footing so the suite holds on Windows too.
const R = (p: string): string => path.resolve(p);

let userRoot: string;

function freshRoot(): void {
  userRoot = mkdtempSync(path.join(tmpdir(), "ewpp-wall-mem-"));
  (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA = userRoot;
  delete process.env.EDGWARE_PANIC_SKIP_WALLPAPER;
  invalidateConfigCache();
  getMock.mockReset();
  setMock.mockReset();
  setMock.mockResolvedValue(undefined);
}

function cleanRoot(): void {
  rmSync(userRoot, { recursive: true, force: true });
  delete (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA;
}

describe("wallpaperMemory apply/restore contract", () => {
  beforeEach(freshRoot);
  afterEach(cleanRoot);

  it("a successful apply caches the original and marks the state dirty", async () => {
    getMock.mockResolvedValue("/user/orig.jpg");
    await applyWallpaper("/pack/new.jpg");
    expect(setMock).toHaveBeenCalledWith("/pack/new.jpg");
    expect(readState()).toEqual({
      original: "/user/orig.jpg",
      dirty: true,
      applied: [R("/pack/new.jpg")],
    });
  });

  it("a cleanly failed apply clears the dirty flag it just set", async () => {
    getMock.mockResolvedValue("/user/orig.jpg");
    setMock.mockRejectedValue(new Error("osascript exploded"));
    await expect(applyWallpaper("/pack/broken.jpg")).rejects.toThrow("osascript exploded");
    // The wallpaper never changed: no restore may be pending against it.
    expect(readState()?.dirty).toBe(false);
  });

  it("a failed apply keeps a dirty flag from an earlier successful change", async () => {
    getMock.mockResolvedValue("/user/orig.jpg");
    await applyWallpaper("/pack/first.jpg"); // succeeds, dirties
    setMock.mockRejectedValue(new Error("second apply exploded"));
    await expect(applyWallpaper("/pack/second.jpg")).rejects.toThrow();
    // The first change is real and still needs the restore.
    expect(readState()).toEqual({
      original: "/user/orig.jpg",
      dirty: true,
      applied: [R("/pack/first.jpg"), R("/pack/second.jpg")],
    });
  });

  it("restore skips the re-set when the desktop already shows the original", async () => {
    const orig = path.join(userRoot, "orig.jpg");
    writeFileSync(orig, "x");
    getMock.mockResolvedValue(orig);
    await applyWallpaper("/pack/wall.jpg");
    setMock.mockClear();

    getMock.mockResolvedValue(orig); // desktop still/again on the original
    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(setMock).not.toHaveBeenCalled();
    expect(readState()?.dirty).toBe(false);
  });

  it("restore re-applies the original when the desktop shows something else", async () => {
    const orig = path.join(userRoot, "orig.jpg");
    writeFileSync(orig, "x");
    getMock.mockResolvedValue(orig);
    await applyWallpaper("/pack/wall.jpg");

    getMock.mockResolvedValue("/pack/wall.jpg");
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(orig);
    expect(readState()?.dirty).toBe(false);
  });

  it("restore still runs when the current wallpaper cannot be read", async () => {
    const orig = path.join(userRoot, "orig.jpg");
    writeFileSync(orig, "x");
    getMock.mockResolvedValue(orig);
    await applyWallpaper("/pack/wall.jpg");

    getMock.mockRejectedValue(new Error("osascript timeout"));
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(orig);
  });

  it("restore retires the flag without touching the desktop when the original is gone", async () => {
    getMock.mockResolvedValue(path.join(userRoot, "orig.jpg")); // never created
    await applyWallpaper("/pack/wall.jpg");
    setMock.mockClear();

    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(setMock).not.toHaveBeenCalled();
    expect(readState()?.dirty).toBe(false);
  });

  it("the disabled switch leaves no state behind across a full apply cycle", async () => {
    process.env.EDGWARE_PANIC_SKIP_WALLPAPER = "1";
    getMock.mockResolvedValue("/user/orig.jpg");
    await applyWallpaper("/pack/new.jpg");
    expect(setMock).toHaveBeenCalledWith("/pack/new.jpg");
    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(readState()).toBeNull();
  });
});

describe("panic-image poisoning guard", () => {
  beforeEach(freshRoot);
  afterEach(cleanRoot);

  it("refuses to cache a panic wallpaper as the user's original", async () => {
    // The desktop still shows a legacy install's panic image at the first
    // change: caching it would make every future restore re-apply it.
    getMock.mockResolvedValue("/some/where/EdgewarePlusPlusMacosPython/data/panic_wallpaper.png");
    await applyWallpaper("/pack/new.jpg");
    expect(setMock).toHaveBeenCalledWith("/pack/new.jpg");
    // Nothing usable is cached, so no restore can re-apply a panic image.
    expect(readState()).toEqual({ original: "", dirty: false, applied: [R("/pack/new.jpg")] });
  });

  it("retires a poisoned cache instead of restoring the panic image", async () => {
    const poisoned = path.join(userRoot, "panic_wallpaper.png");
    writeFileSync(poisoned, "x");
    writeState({ original: poisoned, dirty: true });
    getMock.mockResolvedValue("/desktop/current.jpg");
    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(setMock).not.toHaveBeenCalled();
    expect(readState()?.dirty).toBe(false);
  });

  it("re-captures instead of re-dirtying a poisoned cache on the next change", async () => {
    // The exact resurrection the field logs showed: retire marks the
    // poisoned entry clean, the next wallpaper change must NOT re-dirty it.
    const poisoned = path.join(userRoot, "panic_wallpaper.png");
    writeFileSync(poisoned, "x");
    writeState({ original: poisoned, dirty: false });
    getMock.mockResolvedValue(path.join(userRoot, "realdesk.jpg"));
    await applyWallpaper("/pack/new.jpg");
    expect(readState()).toEqual({
      original: path.join(userRoot, "realdesk.jpg"),
      dirty: true,
      applied: [R("/pack/new.jpg")],
    });
  });

  it("still caches and restores ordinary wallpapers (including pack files)", async () => {
    const packWall = path.join(userRoot, "packs", "CaliaWare", "wallpapergood.png");
    mkdirSync(path.dirname(packWall), { recursive: true });
    writeFileSync(packWall, "x");
    getMock.mockResolvedValue(packWall);
    await applyWallpaper("/pack/new.jpg");
    expect(readState()).toEqual({
      original: packWall,
      dirty: true,
      applied: [R("/pack/new.jpg")],
    });
    getMock.mockResolvedValue("/pack/new.jpg");
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(packWall);
  });
});

describe("app-applied wallpaper poisoning (shipped-release flaw)", () => {
  beforeEach(freshRoot);
  afterEach(cleanRoot);

  function makePack(dirName: string): string {
    const dir = path.join(userRoot, "packs", dirName);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function registerPacks(...dirs: string[]): void {
    mkdirSync(path.join(userRoot, "data"), { recursive: true });
    writeFileSync(
      path.join(userRoot, "data", "config.json"),
      JSON.stringify({ packPath: dirs[0], packFolders: dirs }),
      "utf-8"
    );
    invalidateConfigCache();
  }

  it("startup restore never re-applies a legacy pack-poisoned original", async () => {
    // The shipped flaw: an old build captured a pack's corruption wallpaper
    // as the "original" while it was still on screen. The state survives an
    // upgrade; the first restore must drop the poison instead of re-applying
    // the pack image over the user's desktop.
    const packDir = makePack("AddictAcceptanceProgram");
    registerPacks(packDir);
    const packWall = path.join(packDir, "wallpapergood.png");
    writeFileSync(packWall, "x");
    writeState({ original: packWall, dirty: true }); // legacy shape: no applied set

    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(setMock).not.toHaveBeenCalled();
    const state = readState();
    expect(state?.original).toBe("");
    expect(state?.dirty).toBe(false);
    expect(state?.applied).toContain(packWall);
  });

  it("migration checks every registered pack folder, not just the active one", async () => {
    // The owner's real state: poison from pack A while pack B is active.
    const packA = makePack("AddictAcceptanceProgram");
    const packB = makePack("Test Pack V2");
    registerPacks(packB, packA);
    const packWall = path.join(packA, "wallpapergood.png");
    writeFileSync(packWall, "x");
    writeState({ original: packWall, dirty: true });

    await expect(restoreWallpaperIfDirty()).resolves.toBe(false);
    expect(setMock).not.toHaveBeenCalled();
    expect(readState()?.original).toBe("");
  });

  it("a legacy original outside any pack is kept and still restored", async () => {
    const orig = path.join(userRoot, "my-desk.jpg");
    writeFileSync(orig, "x");
    registerPacks(makePack("SomePack"));
    writeState({ original: orig, dirty: true });
    getMock.mockResolvedValue("/pack/leftover.jpg");

    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(orig);
  });

  it("an app-applied wallpaper is never re-captured as the user's original", async () => {
    // Apply, restore cleanly, then lose the original (retire): a desktop
    // stranded on the app's own wallpaper must not be cached as the baseline.
    const packWall = path.join(makePack("AAP"), "wall.jpg");
    writeFileSync(packWall, "x");
    const orig = path.join(userRoot, "orig.jpg");
    writeFileSync(orig, "x");
    getMock.mockResolvedValue(orig);
    await applyWallpaper(packWall);
    getMock.mockResolvedValue(packWall);
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);

    writeState({ original: "", dirty: false, applied: [packWall] });
    getMock.mockResolvedValue(packWall); // desktop stuck on the pack image
    await applyWallpaper(path.join(userRoot, "next.jpg"));
    expect(readState()?.original).toBe(""); // refused to cache packWall
    expect(readState()?.dirty).toBe(false);
  });

  it("re-captures the user's desktop once it shows something the app never applied", async () => {
    // The recovery path: after the cache is retired, the user sets their own
    // picture (outside the app). The next app change sees a desktop that is
    // not app output and caches it as the new baseline.
    const packWall = path.join(makePack("AAP"), "wall.jpg");
    writeFileSync(packWall, "x");
    writeState({ original: "", dirty: false, applied: [packWall] });

    const userDesk = path.join(userRoot, "user-desk.jpg");
    writeFileSync(userDesk, "x");
    getMock.mockResolvedValue(userDesk);
    await applyWallpaper(packWall);
    expect(readState()).toEqual({ original: userDesk, dirty: true, applied: [packWall] });

    getMock.mockResolvedValue(packWall);
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(userDesk);
  });
});
