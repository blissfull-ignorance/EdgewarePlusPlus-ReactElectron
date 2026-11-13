import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  resolvePackMediaPath,
  contentTypeForFile,
  MEDIA_SUBDIRS,
} from "../../electron/utils/mediaGuard";

const PACK = "/data/packs/Real Test Pack";

describe("resolvePackMediaPath (media scope guard)", () => {
  it("resolves a valid in-pack media file", () => {
    expect(resolvePackMediaPath(PACK, "img", "seed.png")).toBe(
      path.resolve(PACK, "img", "seed.png")
    );
  });

  it("resolves every real media subdir", () => {
    for (const sub of MEDIA_SUBDIRS as readonly string[]) {
      expect(resolvePackMediaPath(PACK, sub, "f.x")).toBe(
        path.resolve(PACK, sub, "f.x")
      );
    }
  });

  it("handles a nested subfolder name within the media dir", () => {
    // Pack media is flat, but a deeper path must still stay inside the subdir.
    expect(resolvePackMediaPath(PACK, "vid", "a/b.mp4")).toBe(
      path.resolve(PACK, "vid", "a", "b.mp4")
    );
  });

  it("rejects a subdir outside the media whitelist (foreign root)", () => {
    expect(resolvePackMediaPath(PACK, "etc", "passwd")).toBeNull();
    expect(resolvePackMediaPath(PACK, "secrets", "x.png")).toBeNull();
  });

  it("rejects path traversal that escapes the media subdir", () => {
    expect(resolvePackMediaPath(PACK, "img", "../info.json")).toBeNull();
    expect(resolvePackMediaPath(PACK, "img", "../../etc/passwd")).toBeNull();
    expect(resolvePackMediaPath(PACK, "img", "a/../../vid/x")).toBeNull();
  });

  it("confines an absolute-looking rel to the media subdir (never escapes the pack)", () => {
    // A leading-slash path is trapped under <pack>/<subdir>, so it can never map
    // outside the active pack; the missing file then 404s at the handler.
    expect(resolvePackMediaPath(PACK, "img", "/etc/passwd")).toBe(
      path.resolve(PACK, "img", "etc", "passwd")
    );
    const r = resolvePackMediaPath(PACK, "img", "/Users/root/.ssh/id_rsa");
    expect(r).toBe(path.resolve(PACK, "img", "Users", "root", ".ssh", "id_rsa"));
  });

  it("never returns a path outside the active pack for any adversarial input", () => {
    const adversarial = [
      "../",
      "../../etc/passwd",
      "..",
      "a/../../b.png",
      "/etc/passwd",
      "//img/x",
    ];
    const subRoot = path.resolve(PACK, "img");
    for (const rel of adversarial) {
      const r = resolvePackMediaPath(PACK, "img", rel);
      // Either rejected outright, or strictly inside the img subdir — never outside.
      expect(
        r === null || (r !== subRoot && r.startsWith(subRoot + path.sep)),
        `${rel} -> ${r}`
      ).toBe(true);
    }
  });

  it("rejects an empty rel or empty subdir", () => {
    expect(resolvePackMediaPath(PACK, "img", "")).toBeNull();
    expect(resolvePackMediaPath(PACK, "", "seed.png")).toBeNull();
  });

  it("rejects when no pack is selected (null root)", () => {
    expect(resolvePackMediaPath(null, "img", "seed.png")).toBeNull();
  });

  it("rejects NUL bytes in a path segment", () => {
    expect(resolvePackMediaPath(PACK, "img", "a\u0000b.png")).toBeNull();
  });

  it("keeps weird segments inside the media subdir", () => {
    for (const rel of ["a//b.png", " .. /x.png", "img/../../etc/passwd", "ünïcode/ok.png"]) {
      const r = resolvePackMediaPath(PACK, "img", rel);
      if (r !== null) {
        expect(r.startsWith(path.resolve(PACK, "img") + path.sep)).toBe(true);
      }
    }
  });

  it("serves hypno overlay media from hypno/ and the legacy subliminals/ dir", () => {
    expect(resolvePackMediaPath(PACK, "hypno", "obedience.gif")).toBe(
      path.resolve(PACK, "hypno", "obedience.gif")
    );
    expect(resolvePackMediaPath(PACK, "subliminals", "old-spiral.gif")).toBe(
      path.resolve(PACK, "subliminals", "old-spiral.gif")
    );
  });

  it("keeps hypno/subliminals requests confined to their own subdir", () => {
    expect(resolvePackMediaPath(PACK, "hypno", "../img/evil.png")).toBeNull();
    expect(resolvePackMediaPath(PACK, "subliminals", "../../etc/passwd")).toBeNull();
  });
});

describe("contentTypeForFile", () => {
  it("maps known media extensions", () => {
    expect(contentTypeForFile("applelw.png")).toBe("image/png");
    expect(contentTypeForFile("tempest.mp4")).toBe("video/mp4");
    expect(contentTypeForFile("think.wav")).toBe("audio/wav");
  });
  it("falls back to octet-stream for unknowns", () => {
    expect(contentTypeForFile("blob.xyz")).toBe("application/octet-stream");
  });
});
