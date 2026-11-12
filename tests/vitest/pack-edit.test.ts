import { describe, expect, it } from "vitest";
import { addMood, listMoodNames, removeMood, renameMood, setFileTags, type RawIndexLike } from "../../electron/utils/packEdit";

const base = (): RawIndexLike => ({
  default: { maxClicks: 1, captions: ["base"] },
  moods: [
    { mood: "vanilla", captions: ["v"], media: ["a.png"] },
    { mood: "goon", captions: ["g"], media: ["b.png"] },
  ],
  customTopLevel: { keep: true },
});

describe("packEdit", () => {
  it("adds a mood with empty lists", () => {
    const next = addMood(base(), "voice");
    expect(listMoodNames(next)).toEqual(["vanilla", "goon", "voice"]);
    const voice = (next.moods as RawIndexLike[])[2];
    expect(voice).toMatchObject({ mood: "voice", media: [] });
  });

  it("ignores duplicate and blank mood names", () => {
    expect(listMoodNames(addMood(base(), "vanilla"))).toEqual(["vanilla", "goon"]);
    expect(listMoodNames(addMood(base(), "   "))).toEqual(["vanilla", "goon"]);
  });

  it("removes a mood and untags it from other moods' media lists", () => {
    const withCross: RawIndexLike = {
      moods: [
        { mood: "a", media: ["x.png"] },
        { mood: "b", media: ["x.png", "a"] },
      ],
    };
    const next = removeMood(withCross, "a");
    expect(listMoodNames(next)).toEqual(["b"]);
    expect((next.moods as RawIndexLike[])[0].media).toEqual(["x.png"]);
  });

  it("sets the exact tag set of a file across moods", () => {
    const next = setFileTags(base(), "c.png", ["goon"]);
    const moods = next.moods as RawIndexLike[];
    expect(moods[0].media).toEqual(["a.png"]);
    expect(moods[1].media).toEqual(["b.png", "c.png"]);
  });

  it("removes a file from tags it no longer has", () => {
    const next = setFileTags(base(), "a.png", []);
    expect((next.moods as RawIndexLike[])[0].media).toEqual([]);
  });

  it("moves a file between moods in one call", () => {
    const next = setFileTags(base(), "a.png", ["goon"]);
    const moods = next.moods as RawIndexLike[];
    expect(moods[0].media).toEqual([]);
    expect(moods[1].media).toEqual(["b.png", "a.png"]);
  });

  it("preserves unrecognized index fields", () => {
    const next = setFileTags(base(), "a.png", ["goon"]);
    expect(next.default).toEqual({ maxClicks: 1, captions: ["base"] });
    expect(next.customTopLevel).toEqual({ keep: true });
  });

  it("tolerates malformed mood entries", () => {
    const messy: RawIndexLike = {
      moods: [null, "nope", 5, { mood: "", media: ["z"] }, { mood: "ok", media: "not-array" }, { mood: "fine", media: ["f.png"] }],
    };
    const next = setFileTags(messy, "f.png", ["ok"]);
    const moods = next.moods as RawIndexLike[];
    // Malformed entries pass through untouched; valid ones are rewritten.
    expect(moods.slice(0, 4)).toEqual(messy.moods!.slice(0, 4));
    const ok = moods.find((m) => m && (m as RawIndexLike).mood === "ok") as RawIndexLike;
    expect(ok.media).toEqual(["f.png"]);
    const fine = moods.find((m) => m && (m as RawIndexLike).mood === "fine") as RawIndexLike;
    expect(fine.media).toEqual([]);
  });

  it("renames a mood in place", () => {
    const next = renameMood(base(), "vanilla", "classic");
    expect(listMoodNames(next)).toEqual(["classic", "goon"]);
  });

  it("rename is a no-op for blank, identical or colliding names", () => {
    const b = base();
    // The IPC layer relies on reference identity to skip propagation.
    expect(renameMood(b, "vanilla", "goon")).toBe(b);
    expect(listMoodNames(renameMood(base(), "vanilla", "  "))).toEqual(["vanilla", "goon"]);
    expect(listMoodNames(renameMood(base(), "vanilla", "vanilla"))).toEqual(["vanilla", "goon"]);
    expect(listMoodNames(renameMood(base(), "vanilla", "goon"))).toEqual(["vanilla", "goon"]);
    expect(listMoodNames(renameMood(base(), "ghost", "x"))).toEqual(["vanilla", "goon"]);
  });

  it("handles an index without moods", () => {
    expect(listMoodNames({})).toEqual([]);
    expect(listMoodNames(addMood({}, "m1"))).toEqual(["m1"]);
    expect(setFileTags({}, "x.png", ["m1"]).moods).toEqual([]);
  });
});
