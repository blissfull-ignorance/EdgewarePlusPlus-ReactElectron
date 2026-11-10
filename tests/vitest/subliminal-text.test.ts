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

describe("mood gating (legacy default + active moods only)", () => {
  const idx = {
    default: { subliminals: ["base"], captions: ["base cap"], notifications: ["base note"] },
    moods: [
      { name: "vanilla", subliminals: ["vanilla sub"], captions: ["vanilla cap"], notifications: ["vanilla note"] },
      { name: "goon", subliminals: ["goon sub"], captions: ["goon cap"], notifications: ["goon note"] },
    ],
  } as unknown as Parameters<typeof pickSubliminalText>[0];

  it("excludes inactive mood lists from the subliminal pool", () => {
    const active = new Set(["vanilla"]);
    for (const r of [0, 0.3, 0.6, 0.9]) {
      expect(["base", "vanilla sub"]).toContain(pickSubliminalText(idx, () => r, active));
    }
  });

  it("includes every active mood's lists", () => {
    const active = new Set(["vanilla", "goon"]);
    const pool = ["base", "vanilla sub", "goon sub"];
    for (const r of [0, 0.4, 0.8]) {
      expect(pool).toContain(pickSubliminalText(idx, () => r, active));
    }
  });

  it("falls back to default + active captions when no subliminals match", () => {
    const bare = {
      default: { captions: ["base cap"] },
      moods: [{ name: "locked", captions: ["locked cap"] }],
    } as unknown as Parameters<typeof pickSubliminalText>[0];
    expect(pickSubliminalText(bare, () => 0, new Set())).toBe("base cap");
  });

  it("excludes inactive mood notifications", () => {
    const active = new Set(["vanilla"]);
    for (const r of [0, 0.4, 0.8]) {
      expect(["base note", "vanilla note"]).toContain(
        pickNotificationText(idx, () => r, active)
      );
    }
  });

  it("keeps every mood when no active set is given (ungated callers)", () => {
    const pool = ["base", "vanilla sub", "goon sub"];
    for (const r of [0, 0.4, 0.8]) {
      expect(pool).toContain(pickSubliminalText(idx, () => r));
    }
  });
});
