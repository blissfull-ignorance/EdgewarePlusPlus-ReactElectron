import { describe, expect, it } from "vitest";
import { buildFileMoods } from "../../electron/utils/galleryIndex";

describe("buildFileMoods", () => {
  it("maps modern index moods to their media files", () => {
    const map = buildFileMoods(
      [
        { mood: "vanilla", media: ["a.png", "b.png"] },
        { mood: "goon", media: ["c.png"] },
      ],
      undefined
    );
    expect(map).toEqual({ "a.png": ["vanilla"], "b.png": ["vanilla"], "c.png": ["goon"] });
  });

  it("collects multiple mood tags for one file", () => {
    const map = buildFileMoods(
      [
        { mood: "vanilla", media: ["x.png"] },
        { mood: "goon", media: ["x.png"] },
      ],
      undefined
    );
    expect(map["x.png"]).toEqual(["vanilla", "goon"]);
  });

  it("never duplicates the same tag", () => {
    const map = buildFileMoods(
      [
        { mood: "vanilla", media: ["x.png"] },
        { mood: "vanilla", media: ["x.png", "y.png"] },
      ],
      undefined
    );
    expect(map["x.png"]).toEqual(["vanilla"]);
  });

  it("merges legacy media.json mood keys", () => {
    const map = buildFileMoods(
      [{ mood: "modern", media: ["m.png", "shared.png"] }],
      { default: ["ignored.png"], legacy: ["l.png", "shared.png"] }
    );
    expect(map["l.png"]).toEqual(["legacy"]);
    expect(map["shared.png"]).toEqual(["modern", "legacy"]);
    expect(map["ignored.png"]).toBeUndefined();
  });

  it("skips malformed entries without throwing", () => {
    const map = buildFileMoods(
      [
        { mood: "", media: ["x.png"] },
        { mood: "ok", media: "not-an-array" },
        { mood: 42, media: ["y.png"] },
        { mood: "fine", media: ["z.png", 7, null, ""] },
      ] as never,
      { bad: "not-an-array", ok: [null, 3, "good.wav"] } as never
    );
    expect(map).toEqual({ "z.png": ["fine"], "good.wav": ["ok"] });
  });

  it("returns an empty map for missing inputs", () => {
    expect(buildFileMoods(undefined, undefined)).toEqual({});
  });
});
