import { describe, expect, it } from "vitest";
import {
  joinTags,
  buildSearchUrl,
  parseSearchResponse,
  cacheFileName,
} from "../../electron/utils/booru";

describe("joinTags", () => {
  it("converts the '>'-joined tagList into a space query", () => {
    expect(joinTags("cat>ears>blue_eyes")).toBe("cat ears blue_eyes");
  });

  it("passes 'all' through and tolerates blanks", () => {
    expect(joinTags("all")).toBe("all");
    expect(joinTags("a>>b ")).toBe("a b");
    expect(joinTags("")).toBe("");
  });
});

describe("buildSearchUrl", () => {
  it("builds the gelbooru dapi JSON query", () => {
    const url = buildSearchUrl("https://gelbooru.com/", "cat ears");
    expect(url).toContain("index.php?");
    expect(url).toContain("page=dapi");
    expect(url).toContain("s=post");
    expect(url).toContain("json=1");
    expect(url).toContain("limit=1");
    expect(url).toContain("tags=cat+ears");
  });

  it("falls back to 'all' for an empty tag query", () => {
    expect(buildSearchUrl("https://gelbooru.com", "")).toContain("tags=all");
  });
});

describe("parseSearchResponse", () => {
  it("extracts the first post's file_url", () => {
    expect(
      parseSearchResponse({ post: [{ file_url: "https://img1/1.jpg" }, { file_url: "https://img2/2.jpg" }] })
    ).toBe("https://img1/1.jpg");
  });

  it("handles the single-object shape gelbooru returns for one hit", () => {
    expect(parseSearchResponse({ post: { file_url: "https://img1/1.jpg" } })).toBe(
      "https://img1/1.jpg"
    );
  });

  it("returns null for empty or malformed payloads", () => {
    expect(parseSearchResponse({ post: [] })).toBeNull();
    expect(parseSearchResponse({})).toBeNull();
    expect(parseSearchResponse(null)).toBeNull();
    expect(parseSearchResponse({ post: [{ file_url: "ftp://nope" }] })).toBeNull();
  });
});

describe("cacheFileName", () => {
  it("keeps a clean basename and extension", () => {
    expect(cacheFileName("https://img3.gelbooru.com/images/ab/ab12cd34.png")).toBe("ab12cd34.png");
  });

  it("strips query strings and unsafe characters", () => {
    expect(cacheFileName("https://x/../evil?token=1")).toBe("evil.jpg");
  });

  it("restricts extensions to image types", () => {
    expect(cacheFileName("https://x/file.exe")).toBe("file.jpg");
    expect(cacheFileName("https://x/file.webp")).toBe("file.webp");
  });
});
