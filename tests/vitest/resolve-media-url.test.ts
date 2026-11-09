import { describe, expect, it } from "vitest";
import {
  DEFAULT_HYPNO_ASSET,
  resolveHypnoGifUrl,
  resolvePackMediaUrl,
} from "../../src/features/popup/resolveMediaUrl";

describe("resolvePackMediaUrl", () => {
  it("maps a bare filename to the packmedia scheme for the given subdir", () => {
    expect(resolvePackMediaUrl("seed.png", "img")).toBe("packmedia://img/seed.png");
    expect(resolvePackMediaUrl("tempest.mp4", "vid")).toBe("packmedia://vid/tempest.mp4");
    expect(resolvePackMediaUrl("think.wav", "aud")).toBe("packmedia://aud/think.wav");
  });

  it("ignores a leading subdir prefix on the id and re-scopes by type", () => {
    // Pack IPC may hand back "img/foo.png"; anchor the authoritative subdir to the popup type.
    expect(resolvePackMediaUrl("img/foo.png", "img")).toBe("packmedia://img/foo.png");
    expect(resolvePackMediaUrl("vid/bar.mp4", "vid")).toBe("packmedia://vid/bar.mp4");
  });

  it("URL-encodes special characters in the filename", () => {
    expect(resolvePackMediaUrl("my file.png", "img")).toBe(
      `packmedia://img/${encodeURIComponent("my file.png")}`
    );
  });

  it("passes data-URIs through untouched (browser-layer test strategy)", () => {
    const duri = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
    expect(resolvePackMediaUrl(duri, "img")).toBe(duri);
  });

  it("passes http(s), blob and existing packmedia URLs through untouched", () => {
    expect(resolvePackMediaUrl("https://example.com/a.png", "img")).toBe(
      "https://example.com/a.png"
    );
    expect(resolvePackMediaUrl("blob:abc", "vid")).toBe("blob:abc");
    expect(resolvePackMediaUrl("packmedia://img/x.png", "img")).toBe(
      "packmedia://img/x.png"
    );
  });

  it("returns the empty id unchanged", () => {
    expect(resolvePackMediaUrl("", "img")).toBe("");
  });

  it("maps hypno overlay media through the hypno subdir", () => {
    expect(resolvePackMediaUrl("obedience.gif", "hypno")).toBe("packmedia://hypno/obedience.gif");
  });
});

describe("resolveHypnoGifUrl", () => {
  it("serves subdir-qualified pack spirals from the exact directory they live in", () => {
    expect(resolveHypnoGifUrl("hypno/obedience.gif")).toBe("packmedia://hypno/obedience.gif");
    expect(resolveHypnoGifUrl("subliminals/old.gif")).toBe("packmedia://subliminals/old.gif");
  });

  it("anchors bare names under hypno/", () => {
    expect(resolveHypnoGifUrl("spiral.gif")).toBe("packmedia://hypno/spiral.gif");
  });

  it("loads the built-in default spiral as a plain app asset", () => {
    expect(resolveHypnoGifUrl(DEFAULT_HYPNO_ASSET)).toBe(DEFAULT_HYPNO_ASSET);
  });

  it("passes absolute URLs through and keeps empty input empty", () => {
    const duri = "data:image/gif;base64,R0lGOD";
    expect(resolveHypnoGifUrl(duri)).toBe(duri);
    expect(resolveHypnoGifUrl("")).toBe("");
  });
});
