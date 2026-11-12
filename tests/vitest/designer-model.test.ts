import { describe, expect, it } from "vitest";
import {
  emptyDesign,
  generateCorruptionJson,
  generateLua,
  normalizeDesign,
  parseDesignerScript,
  renameMoodInCorruption,
  renameMoodInDesign,
  replaceDesignInScript,
  type DesignerScript,
} from "../../src/features/creator/designerModel";
import { parseCorruptionData } from "../../src/features/corruption/corruptionEngine";

const design: DesignerScript = {
  version: 1,
  startDelaySeconds: 3,
  levels: [
    {
      addMoods: ["vanilla"],
      removeMoods: [],
      wallpaper: "wall1.png",
      actions: [
        { kind: "notification", text: "hello \"world\"\nline2" },
        { kind: "image", file: "a.png" },
      ],
      advance: { mode: "audio", file: "voice.wav" },
      config: { popupMod: 80 },
    },
    {
      addMoods: ["goon"],
      removeMoods: ["vanilla"],
      wallpaper: null,
      actions: [{ kind: "subliminal", text: "obey", chance: 40 }],
      advance: { mode: "time", seconds: 7 },
      config: {},
    },
    {
      addMoods: [],
      removeMoods: [],
      wallpaper: null,
      actions: [],
      advance: { mode: "end" },
      config: {},
    },
  ],
};

describe("designerModel", () => {
  it("generates a chained Lua script with corrupt() per level", () => {
    const lua = generateLua(design);
    expect(lua).toContain('require("edgeware_v0")');
    expect(lua).toContain("local function level3()");
    expect(lua).toContain("local function level2()");
    expect(lua).toContain("local function level1()");
    expect(lua).toContain("corrupt()");
    expect(lua).toContain('audio("voice.wav", function() level2() end)');
    expect(lua).toContain("after(7000, level3)");
    expect(lua).toContain("after(3000, level1)");
    // Quotes and newlines in texts are Lua-escaped.
    expect(lua).toContain('notification("hello \\"world\\"\\nline2")');
  });

  it("generates corruption.json the runtime parser actually consumes", () => {
    // Assert against the real consumer, not the generator's own shape.
    const parsed = parseCorruptionData(JSON.parse(generateCorruptionJson(design)));
    expect([...parsed.levels[1].addMoods]).toEqual(["vanilla"]);
    expect([...parsed.levels[1].removeMoods]).toEqual([]);
    expect(parsed.levels[1].wallpaper).toBe("img/wall1.png");
    expect([...parsed.levels[2].addMoods]).toEqual(["goon"]);
    expect([...parsed.levels[2].removeMoods]).toEqual(["vanilla"]);
    expect(parsed.levels[2].wallpaper).toBeNull();
    expect(parsed.levels[3].wallpaper).toBeNull();
    expect(parsed.levels[1].config).toEqual({ popupMod: 80 });
    expect(parsed.levels[2].config).toEqual({});
  });

  it("wraps chance-gated actions in roll()", () => {
    const lua = generateLua(design);
    expect(lua).toContain("if roll(40) then\n    subliminal(\"obey\")\n  end");
  });

  it("generates the extended action kinds", () => {
    const lua = generateLua({
      version: 1,
      startDelaySeconds: 1,
      levels: [
        {
          addMoods: [],
          removeMoods: [],
          wallpaper: null,
          actions: [
            { kind: "audio", file: "a.wav" },
            { kind: "web", text: "https://example.com" },
            { kind: "close_popups" },
            { kind: "set_close_text", text: "Nope" },
            { kind: "web" },
          ],
          advance: { mode: "end" },
          config: {},
        },
      ],
    });
    expect(lua).toContain('audio("a.wav")');
    expect(lua).toContain('web("https://example.com")');
    expect(lua).toContain("close_popups()");
    expect(lua).toContain('set_popup_close_text("Nope")');
    // A web action without a URL generates nothing.
    expect(lua.match(/web\(/g)?.length).toBe(1);
  });

  it("propagates mood renames into designs, corruption tables and markers", () => {
    const renamed = renameMoodInDesign(design, "vanilla", "classic");
    expect(renamed.levels[0].addMoods).toEqual(["classic"]);
    expect(renamed.levels[1].removeMoods).toEqual(["classic"]);
    const removed = renameMoodInDesign(design, "vanilla", "");
    expect(removed.levels[0].addMoods).toEqual([]);
    expect(removed.levels[1].removeMoods).toEqual([]);

    const parsed = JSON.parse(generateCorruptionJson(design));
    const after = renameMoodInCorruption(parsed, "vanilla", "classic");
    expect(after.moods["1"].add).toEqual(["classic"]);
    expect(after.moods["2"].remove).toEqual(["classic"]);
    expect(renameMoodInCorruption(after, "classic", "").moods["1"].add).toEqual([]);

    const lua = replaceDesignInScript(generateLua(design), renamed);
    expect(parseDesignerScript(lua)).toEqual(renamed);
    // Hand-written scripts without a marker pass through untouched.
    const plain = 'require("edgeware_v0")\ncorrupt()\n';
    expect(replaceDesignInScript(plain, renamed)).toBe(plain);
  });

  it("normalizes the last level to a terminal advance", () => {
    const stale: DesignerScript = {
      version: 1,
      startDelaySeconds: 1,
      levels: [
        { addMoods: [], removeMoods: [], wallpaper: null, actions: [], advance: { mode: "audio", file: "a.wav" } },
        { addMoods: [], removeMoods: [], wallpaper: null, actions: [], advance: { mode: "audio", file: "b.wav" } },
      ],
    };
    const next = normalizeDesign(stale);
    expect(next.levels[0].advance).toEqual({ mode: "audio", file: "a.wav" });
    expect(next.levels[1].advance).toEqual({ mode: "end" });
    expect(normalizeDesign(emptyDesign())).toEqual(emptyDesign());
  });

  it("escapes control characters in generated Lua strings", () => {
    const tricky: DesignerScript = {
      version: 1,
      startDelaySeconds: 1,
      levels: [
        {
          addMoods: [],
          removeMoods: [],
          wallpaper: null,
          actions: [{ kind: "notification", text: "a\u0000b\u0007c\rd\te" }],
          advance: { mode: "end" },
        },
      ],
    };
    const lua = generateLua(tricky);
    expect(lua).not.toContain("\u0000");
    expect(lua).toContain('notification("abc\\nd\\te")');
  });

  it("round-trips the design through the marker block", () => {
    const lua = generateLua(design);
    expect(parseDesignerScript(lua)).toEqual(design);
  });

  it("returns null for hand-written scripts", () => {
    expect(parseDesignerScript('require("edgeware_v0")\ncorrupt()\n')).toBeNull();
    expect(parseDesignerScript("-- [EDGWARE-DESIGNER]{broken")).toBeNull();
    expect(parseDesignerScript("-- [EDGWARE-DESIGNER]{\"version\":2}")).toBeNull();
  });

  it("sanitizes hostile parsed designs", () => {
    const dirty = `-- [EDGWARE-DESIGNER]${JSON.stringify({
      version: 1,
      startDelaySeconds: "x",
      levels: [
        { addMoods: ["ok", 5], removeMoods: null, wallpaper: 7, actions: [{ kind: "bogus" }, { kind: "image", file: "a.png" }], advance: { mode: "weird" } },
      ],
    })}`;
    const parsed = parseDesignerScript(dirty);
    expect(parsed).not.toBeNull();
    expect(parsed!.startDelaySeconds).toBe(2);
    expect(parsed!.levels[0].addMoods).toEqual(["ok"]);
    expect(parsed!.levels[0].removeMoods).toEqual([]);
    expect(parsed!.levels[0].wallpaper).toBeNull();
    expect(parsed!.levels[0].actions).toEqual([{ kind: "image", file: "a.png" }]);
    expect(parsed!.levels[0].advance).toEqual({ mode: "time", seconds: 10 });
    expect(parsed!.levels[0].config).toEqual({ popupMod: undefined, delay: undefined });
  });

  it("empty design generates a valid no-level script", () => {
    const lua = generateLua(emptyDesign());
    expect(lua).toContain("No levels designed yet");
    expect(parseDesignerScript(lua)).toEqual(emptyDesign());
  });
});
