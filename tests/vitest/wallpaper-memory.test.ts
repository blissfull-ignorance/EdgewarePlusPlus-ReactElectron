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
import { getWallpaper, setWallpaper } from "../../electron/utils/wallpaper";

const getMock = vi.mocked(getWallpaper);
const setMock = vi.mocked(setWallpaper);

function readState(): { original: string; dirty: boolean } | null {
  try {
    return JSON.parse(
      readFileSync(path.join(userRoot, "wallpaper_state.json"), "utf-8")
    ) as { original: string; dirty: boolean };
  } catch {
    return null;
  }
}

let userRoot: string;

describe("wallpaperMemory apply/restore contract", () => {
  beforeEach(() => {
    userRoot = mkdtempSync(path.join(tmpdir(), "ewpp-wall-mem-"));
    (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA = userRoot;
    delete process.env.EDGWARE_PANIC_SKIP_WALLPAPER;
    getMock.mockReset();
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(userRoot, { recursive: true, force: true });
    delete (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA;
  });

  it("a successful apply caches the original and marks the state dirty", async () => {
    getMock.mockResolvedValue("/user/orig.jpg");
    await applyWallpaper("/pack/new.jpg");
    expect(setMock).toHaveBeenCalledWith("/pack/new.jpg");
    expect(readState()).toEqual({ original: "/user/orig.jpg", dirty: true });
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
    expect(readState()).toEqual({ original: "/user/orig.jpg", dirty: true });
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
});

describe("panic-image poisoning guard", () => {
  beforeEach(() => {
    userRoot = mkdtempSync(path.join(tmpdir(), "ewpp-wall-mem-"));
    (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA = userRoot;
    delete process.env.EDGWARE_PANIC_SKIP_WALLPAPER;
    getMock.mockReset();
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(userRoot, { recursive: true, force: true });
    delete (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA;
  });

  it("refuses to cache a panic wallpaper as the user's original", async () => {
    // The desktop still shows a legacy install's panic image at the first
    // change: caching it would make every future restore re-apply it.
    getMock.mockResolvedValue("/some/where/EdgewarePlusPlusMacosPython/data/panic_wallpaper.png");
    await applyWallpaper("/pack/new.jpg");
    expect(setMock).toHaveBeenCalledWith("/pack/new.jpg");
    // Nothing usable is cached, so no restore can re-apply a panic image.
    expect(readState()).toEqual({ original: "", dirty: false });
  });

  it("retires a poisoned cache instead of restoring the panic image", async () => {
    const poisoned = path.join(userRoot, "panic_wallpaper.png");
    writeFileSync(poisoned, "x");
    writeFileSync(
      path.join(userRoot, "wallpaper_state.json"),
      JSON.stringify({ original: poisoned, dirty: true })
    );
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
    writeFileSync(
      path.join(userRoot, "wallpaper_state.json"),
      JSON.stringify({ original: poisoned, dirty: false })
    );
    getMock.mockResolvedValue("/Users/flst01/Pictures/realdesk.jpg");
    await applyWallpaper("/pack/new.jpg");
    expect(readState()).toEqual({ original: "/Users/flst01/Pictures/realdesk.jpg", dirty: true });
  });

  it("still caches and restores ordinary wallpapers (including pack files)", async () => {
    const packWall = path.join(userRoot, "packs", "CaliaWare", "wallpapergood.png");
    mkdirSync(path.dirname(packWall), { recursive: true });
    writeFileSync(packWall, "x");
    getMock.mockResolvedValue(packWall);
    await applyWallpaper("/pack/new.jpg");
    expect(readState()).toEqual({ original: packWall, dirty: true });
    getMock.mockResolvedValue("/pack/new.jpg");
    await expect(restoreWallpaperIfDirty()).resolves.toBe(true);
    expect(setMock).toHaveBeenLastCalledWith(packWall);
  });
});
