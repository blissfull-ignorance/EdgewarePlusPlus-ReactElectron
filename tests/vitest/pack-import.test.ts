import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildZip, buildRawZip } from "../zipFixtures";
import {
  detectUnwrapPrefix,
  extractPackZip,
  isSafeEntryPath,
  parsePackInfo,
  sanitizePackName,
  uniqueDestPath,
  type ImportProgress,
} from "../../electron/utils/packImport";

describe("sanitizePackName", () => {
  it("keeps spaces and unicode while dropping the zip extension", () => {
    expect(sanitizePackName("My Pack.zip")).toBe("My Pack");
    expect(sanitizePackName("Päck ✓.ZIP")).toBe("Päck ✓");
  });

  it("neutralizes absolute paths, separators, and .. sequences", () => {
    expect(sanitizePackName("/absolute/path.zip")).toBe("path");
    const fromWindows = sanitizePackName("..\\..\\evil.zip");
    expect(fromWindows).not.toContain("..");
    expect(fromWindows).not.toContain("/");
    expect(fromWindows).not.toContain("\\");
    const dotDot = sanitizePackName("a..b");
    expect(dotDot).not.toContain("..");
  });

  it("falls back for empty or unusable names", () => {
    expect(sanitizePackName("   ")).toBe("Imported Pack");
  });
});

describe("uniqueDestPath", () => {
  let temp: string;
  beforeAll(() => {
    temp = mkdtempSync(path.join(tmpdir(), "ewpp-unique-"));
  });
  afterAll(() => {
    // Windows: extraction handles can linger a moment after the test.
    rmSync(temp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });

  it("returns the plain path when free and (n) suffixes on collision", () => {
    expect(uniqueDestPath(temp, "my-pack")).toBe(path.join(temp, "my-pack"));
    mkdirSync(path.join(temp, "my-pack"));
    expect(uniqueDestPath(temp, "my-pack")).toBe(path.join(temp, "my-pack (2)"));
    mkdirSync(path.join(temp, "my-pack (2)"));
    expect(uniqueDestPath(temp, "my-pack")).toBe(path.join(temp, "my-pack (3)"));
  });
});

describe("detectUnwrapPrefix", () => {
  it("detects a single shared top-level directory", () => {
    expect(detectUnwrapPrefix(["Nested/info.json", "Nested/img/x.png"])).toBe("Nested");
  });

  it("does not unwrap flat zips", () => {
    expect(detectUnwrapPrefix(["info.json", "img/x.png"])).toBeNull();
  });

  it("does not unwrap zips with multiple top-level entries", () => {
    expect(detectUnwrapPrefix(["a/x", "b/y"])).toBeNull();
  });

  it("does not unwrap a lone top-level file", () => {
    expect(detectUnwrapPrefix(["Nested"])).toBeNull();
    expect(detectUnwrapPrefix([])).toBeNull();
  });
});

describe("isSafeEntryPath", () => {
  const dest = path.join(tmpdir(), "library", "my-pack");

  it("accepts entries that stay inside the destination", () => {
    expect(isSafeEntryPath(dest, "info.json")).toBe(true);
    expect(isSafeEntryPath(dest, "img/seed.png")).toBe(true);
    expect(isSafeEntryPath(dest, "./info.json")).toBe(true);
  });

  it("rejects relative traversal entries", () => {
    expect(isSafeEntryPath(dest, "../../escape.txt")).toBe(false);
    expect(isSafeEntryPath(dest, "../escape.txt")).toBe(false);
    expect(isSafeEntryPath(dest, "a/../../escape.txt")).toBe(false);
  });

  it("rejects absolute entries", () => {
    expect(isSafeEntryPath(dest, "/etc/passwd")).toBe(false);
  });
});

describe("parsePackInfo", () => {
  it("parses name/version/creator from info.json", () => {
    expect(
      parsePackInfo({ name: "Real Pack", version: "3.0", creator: "Dev" }, "fallback")
    ).toEqual({ name: "Real Pack", version: "3.0", creator: "Dev" });
  });

  it("falls back to the directory name and omits missing fields", () => {
    expect(parsePackInfo(null, "My Dir")).toEqual({ name: "My Dir" });
    expect(parsePackInfo({ name: "", version: "" }, "My Dir")).toEqual({ name: "My Dir" });
    expect(parsePackInfo("garbage" as unknown, "My Dir")).toEqual({ name: "My Dir" });
  });
});

describe("extractPackZip", () => {
  let temp: string;
  beforeAll(() => {
    temp = mkdtempSync(path.join(tmpdir(), "ewpp-extract-"));
  });
  afterAll(() => {
    // Windows: extraction handles can linger a moment after the test.
    rmSync(temp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });

  it("extracts a flat zip at the expected depth with real file content", async () => {
    const zipPath = path.join(temp, "flat.zip");
    const dest = path.join(temp, "flat");
    const image = Buffer.from("PNG-BYTES-1234");
    await buildZip(zipPath, {
      "info.json": JSON.stringify({ name: "Flat Pack", version: "1.0" }),
      "img/seed.png": image,
    });

    const progressPoints: ImportProgress[] = [];
    const result = await extractPackZip(zipPath, dest, (p) => progressPoints.push(p));

    expect(result.entryCount).toBe(2);
    expect(readFileSync(path.join(dest, "info.json"), "utf-8")).toBe(
      JSON.stringify({ name: "Flat Pack", version: "1.0" })
    );
    expect(readFileSync(path.join(dest, "img/seed.png"))).toEqual(image);
    expect(progressPoints.at(-1)).toEqual({ done: progressPoints.at(-1)!.total, total: progressPoints.at(-1)!.total });
    expect(progressPoints.at(-1)!.total).toBeGreaterThan(0);
  });

  it("unwraps zips nested one directory deep", async () => {
    const zipPath = path.join(temp, "nested.zip");
    const dest = path.join(temp, "nested");
    await buildZip(zipPath, {
      "Nested Content/info.json": JSON.stringify({ name: "Nested Pack", version: "4.2" }),
      "Nested Content/img/seed.png": Buffer.from("PNG-NESTED"),
      "Nested Content/vid/clip.mp4": Buffer.from("MP4-NESTED"),
    });

    await extractPackZip(zipPath, dest);

    expect(existsSync(path.join(dest, "info.json"))).toBe(true);
    expect(existsSync(path.join(dest, "img/seed.png"))).toBe(true);
    expect(existsSync(path.join(dest, "Nested Content"))).toBe(false);
  });

  it("rejects zips with traversal entries and cleans the partial destination", async () => {
    const zipPath = path.join(temp, "evil.zip");
    const libraryDir = path.join(temp, "library");
    const dest = path.join(libraryDir, "evil-pack");
    mkdirSync(libraryDir, { recursive: true });
    buildRawZip(zipPath, [
      { name: "../../escape.txt", data: Buffer.from("escaped") },
      { name: "inner.txt", data: Buffer.from("inner") },
    ]);

    await expect(extractPackZip(zipPath, dest)).rejects.toThrow(/unsafe archive entry/i);

    expect(existsSync(path.join(temp, "escape.txt"))).toBe(false);
    expect(existsSync(path.join(libraryDir, "escape.txt"))).toBe(false);
    expect(existsSync(dest)).toBe(false);
  });

  it("rejects non-zip files with a visible cause", async () => {
    const notZip = path.join(temp, "garbage.zip");
    writeFileSync(notZip, "this is definitely not a zip archive");
    await expect(extractPackZip(notZip, path.join(temp, "garbage"))).rejects.toThrow(
      /Not a valid zip file/i
    );
    expect(existsSync(path.join(temp, "garbage"))).toBe(false);
  });

  it("rejects a missing source file with a visible cause", async () => {
    await expect(
      extractPackZip(path.join(temp, "missing.zip"), path.join(temp, "missing"))
    ).rejects.toThrow(/not found/i);
  });

  it("rejects empty zips (no entries)", async () => {
    const emptyZip = path.join(temp, "empty.zip");
    buildRawZip(emptyZip, []);
    await expect(extractPackZip(emptyZip, path.join(temp, "empty"))).rejects.toThrow(
      /no extractable files/i
    );
    expect(existsSync(path.join(temp, "empty"))).toBe(false);
  });

  it("leaves nothing outside the destination for deeply nested content", async () => {
    const zipPath = path.join(temp, "deep.zip");
    const dest = path.join(temp, "deep");
    await buildZip(zipPath, {
      "a/b/c/deep.json": JSON.stringify({ ok: true }),
      "a/b/d/inner.json": JSON.stringify({ ok: true }),
    });
    await extractPackZip(zipPath, dest);
    const all = readdirSync(dest, { recursive: true }).map((n) => String(n).replace(/\\/g, "/"));
    expect(all.some((n) => n.endsWith("c/deep.json"))).toBe(true);
    expect(all.some((n) => n.endsWith("d/inner.json"))).toBe(true);
    expect(existsSync(path.join(temp, "b"))).toBe(false);
  });
});
