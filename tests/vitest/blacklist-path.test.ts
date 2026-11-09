import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  sanitizePackDirName,
  resolveBlacklistSource,
  computeBlacklistTarget,
} from "../../electron/utils/blacklist";

describe("sanitizePackDirName", () => {
  it("removes all whitespace like the legacy blacklist directory naming", () => {
    expect(sanitizePackDirName("EdgeWare++ Test Pack V2")).toBe("EdgeWare++TestPackV2");
  });

  it("keeps an already-condensed name intact", () => {
    expect(sanitizePackDirName("CaliaWare")).toBe("CaliaWare");
  });

  it("neutralizes path separators and traversal fragments", () => {
    expect(sanitizePackDirName("../../evil pack")).toBe("....evilpack");
    expect(sanitizePackDirName("a/b\\c")).toBe("abc");
  });
});

describe("resolveBlacklistSource", () => {
  let packDir: string;

  beforeEach(() => {
    packDir = mkdtempSync(path.join(tmpdir(), "ewpp-bl-pack-"));
    mkdirSync(path.join(packDir, "img"));
    mkdirSync(path.join(packDir, "vid"));
    mkdirSync(path.join(packDir, "aud"));
    writeFileSync(path.join(packDir, "img", "one.png"), "x");
    writeFileSync(path.join(packDir, "vid", "clip.mp4"), "x");
  });

  afterEach(() => rmSync(packDir, { recursive: true, force: true }));

  it("finds a file in img", () => {
    expect(resolveBlacklistSource(packDir, "one.png")).toEqual({
      subdir: "img",
      src: path.join(packDir, "img", "one.png"),
    });
  });

  it("finds a file in vid", () => {
    expect(resolveBlacklistSource(packDir, "clip.mp4")?.subdir).toBe("vid");
  });

  it("rejects a missing file", () => {
    expect(resolveBlacklistSource(packDir, "ghost.png")).toBeNull();
  });

  it("rejects traversal attempts", () => {
    expect(resolveBlacklistSource(packDir, "../secrets.txt")).toBeNull();
    expect(resolveBlacklistSource(packDir, "img/x.png")).toBeNull();
  });
});

describe("computeBlacklistTarget", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "ewpp-bl-root-"));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("places the file under <userData>/blacklist/<pack>/", () => {
    const target = computeBlacklistTarget(root, "Real Pack", "one.png");
    expect(target).toBe(path.join(root, "blacklist", "RealPack", "one.png"));
    expect(path.dirname(target)).toBe(path.join(root, "blacklist", "RealPack"));
  });

  it("stays inside the blacklist root for hostile names", () => {
    const target = computeBlacklistTarget(root, "..", "..%2f..%2fescape.png");
    expect(target.startsWith(path.join(root, "blacklist"))).toBe(true);
    expect(existsSync(path.join(root, "escape.png"))).toBe(false);
  });
});
