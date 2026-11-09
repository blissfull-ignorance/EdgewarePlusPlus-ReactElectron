import { describe, expect, it } from "vitest";
import { pickSubliminalText, pickNotificationText } from "../../electron/utils/textPool";

const rand = (v: number) => () => v;

describe("pickNotificationText", () => {
  const rand = (v: number) => () => v;

  it("prefers the notifications list", () => {
    const idx = {
      default: { notifications: ["good girl"], subliminals: ["obey"], captions: ["cap"] },
      moods: [],
    } as unknown as Parameters<typeof pickNotificationText>[0];
    expect(pickNotificationText(idx, rand(0))).toBe("good girl");
  });

  it("falls back to captions when notifications are empty", () => {
    const idx = {
      default: { notifications: [], captions: ["cap one"] },
      moods: [{ notifications: [], captions: ["mood cap"] }],
    } as unknown as Parameters<typeof pickNotificationText>[0];
    const picked = pickNotificationText(idx, rand(0));
    expect(["cap one", "mood cap"]).toContain(picked);
  });

  it("returns null when nothing is defined", () => {
    expect(pickNotificationText(undefined, rand(0))).toBeNull();
  });
});

describe("pickSubliminalText", () => {
  it("prefers the default subliminals list", () => {
    const idx = {
      default: { subliminals: ["obey"], captions: ["cap"] },
      moods: [],
    };
    expect(pickSubliminalText(idx, rand(0))).toBe("obey");
  });

  it("includes mood subliminals in the pool", () => {
    const idx = {
      default: { subliminals: [], captions: [] },
      moods: [{ subliminals: ["mood text"], captions: [] }],
    };
    expect(pickSubliminalText(idx, rand(0))).toBe("mood text");
  });

  it("falls back to captions when no subliminals exist", () => {
    const idx = {
      default: { subliminals: [], captions: ["fallback caption"] },
      moods: [{ subliminals: [], captions: ["mood caption"] }],
    };
    const pool = ["fallback caption", "mood caption"];
    const picked = pickSubliminalText(idx, rand(0));
    expect(pool).toContain(picked);
  });

  it("returns null when neither list has usable entries", () => {
    const idx = {
      default: { subliminals: ["", "  "], captions: [] },
      moods: [],
    };
    expect(pickSubliminalText(idx, rand(0))).toBeNull();
  });

  it("handles a missing index gracefully", () => {
    expect(pickSubliminalText(undefined, rand(0))).toBeNull();
    expect(pickSubliminalText({}, rand(0))).toBeNull();
  });

  it("spreads selection across the pool", () => {
    const idx = {
      default: { subliminals: ["a", "b", "c"], captions: [] },
      moods: [],
    };
    expect(pickSubliminalText(idx, rand(0.99))).toBe("c");
    expect(pickSubliminalText(idx, rand(0.34))).toBe("b");
  });
});
