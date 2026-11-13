import { describe, expect, it } from "vitest";
import {
  designFromScript,
  generateCorruptionJson,
  generateLua,
  parseDesignerScript,
} from "../../src/features/creator/designerModel";

const AAP_STYLE = `require("edgeware_v0")

play_at = 1
true_audio = audio
function audio(file, on_stop)
  true_audio(file, on_stop)
end

function delayed_audio(ms, file, on_stop)
  after(ms, function() audio(file, on_stop) end)
end

function intro()
  -- image("ghost.png")
  image("intro.png")
  if roll(40) then
    video("bonus.mp4")
  end
  delayed_audio(1000, "Voice 1.mp3", step2)
end

function step2()
  while count < 5 do
    image("loop.png")
    count = count + 1
  end
  if roll(chance) then image("rolled.png") end
  corrupt() -- level 1
  image("after1.png")
  audio("Voice 2.mp3", step3)
end

function step3()
  close_popups()
  corrupt() -- level 2
  set_popup_close_text("Nggh~!")
  multiple_popups(95, 3)
  subliminal("TWO")
  web("https://example.com/x")
  web(nil)
  prompt(nil, function() end)
  after(30000, corrupt)
  audio("Voice 3.mp3", step4)
end

function step4()
  corrupt() -- level 3
  audio("Voice 4.mp3", nil)
end

intro()
`;

const TABLES = {
  moods: {
    "1": { add: ["vanilla"], remove: [], wallpaper: "img/wp1.jpg" },
    "2": { add: ["goon"], remove: ["vanilla"] },
  },
  config: { "1": { popupMod: 100, delay: 1 } },
};

describe("designFromScript", () => {
  const { design, notes } = designFromScript(AAP_STYLE, TABLES);
  const report = notes.join(" ");

  it("builds one level per corrupt() (three here, tables only had two)", () => {
    expect(design.levels).toHaveLength(3);
    expect(report).toContain("corrupt() 3 time(s)");
  });

  it("carries moods, wallpaper and config from the corruption tables", () => {
    expect(design.levels[0].addMoods).toEqual(["vanilla"]);
    expect(design.levels[0].wallpaper).toBe("wp1.jpg");
    expect(design.levels[0].config).toEqual({ popupMod: 100, delay: 1 });
    expect(design.levels[1].addMoods).toEqual(["goon"]);
    expect(design.levels[1].removeMoods).toEqual(["vanilla"]);
  });

  it("attaches pre-corrupt actions to level 1 and says so", () => {
    const l1 = design.levels[0].actions;
    expect(l1).toContainEqual({ kind: "image", file: "intro.png" });
    expect(l1).toContainEqual({ kind: "video", file: "bonus.mp4", chance: 40 });
    expect(l1).toContainEqual({ kind: "audio", file: "Voice 1.mp3" });
    expect(report).toContain("before the first corrupt()");
  });

  it("ignores commented-out calls", () => {
    for (const level of design.levels) {
      expect(JSON.stringify(level.actions)).not.toContain("ghost.png");
    }
  });

  it("splits later segments at each corrupt()", () => {
    expect(design.levels[0].actions).toContainEqual({ kind: "image", file: "after1.png" });
    // close_popups() ran before the second corrupt(), so it belongs to level 1.
    expect(design.levels[0].actions).toContainEqual({ kind: "close_popups" });
    expect(design.levels[1].actions).toContainEqual({ kind: "set_close_text", text: "Nggh~!" });
    expect(design.levels[1].actions).toContainEqual({ kind: "subliminal", text: "TWO" });
    expect(design.levels[1].actions).toContainEqual({ kind: "web", text: "https://example.com/x" });
    expect(design.levels[1].actions).toContainEqual({ kind: "prompt" });
    expect(design.levels[2].actions).toContainEqual({ kind: "audio", file: "Voice 4.mp3" });
  });

  it("uses the chained audio as the level advance", () => {
    expect(design.levels[0].advance).toEqual({ mode: "audio", file: "Voice 2.mp3" });
    expect(design.levels[1].advance).toEqual({ mode: "audio", file: "Voice 3.mp3" });
    expect(design.levels[2].advance).toEqual({ mode: "end" });
  });

  it("reports everything it could not represent", () => {
    expect(report).toContain("redefines built-in API(s): audio");
    expect(report).toContain("loop(s) dropped");
    expect(report).toContain("multiple_popups() call(s) dropped");
    expect(report).toContain("web(nil)");
    expect(report).toContain("roll() with a computed chance");
    expect(report).toContain("Callback chains were flattened");
    // The rolled.png guard was computed, so the action survives unguarded.
    expect(design.levels[0].actions).toContainEqual({ kind: "image", file: "rolled.png" });
    expect(design.levels[0].actions).toContainEqual({ kind: "image", file: "loop.png" });
  });

  it("produces a script that round-trips back through the parser", () => {
    const lua = generateLua(design);
    const reparsed = parseDesignerScript(lua);
    expect(reparsed).not.toBeNull();
    expect(reparsed!.levels).toHaveLength(3);
    expect(reparsed!.levels[1].actions).toContainEqual({ kind: "set_close_text", text: "Nggh~!" });
  });

  it("keeps legacy pack-root wallpapers out of the img/ convention", () => {
    const { design: calia } = designFromScript('require("edgeware_v0")\ncorrupt()\ncorrupt()\ncorrupt()\ncorrupt()\n', {
      moods: { "1": { add: [], remove: [] } },
      wallpapers: { "4": "wallpapergood.png", default: "start.png" },
    });
    expect(calia.levels).toHaveLength(4);
    expect(calia.levels[0].wallpaper).toBe("./start.png");
    expect(calia.levels[3].wallpaper).toBe("./wallpapergood.png");
    const json = JSON.parse(generateCorruptionJson(calia));
    expect(json.moods["4"].wallpaper).toBe("./wallpapergood.png");
    expect(json.moods["1"].wallpaper).toBe("./start.png");
  });

  it("collapses a script without corrupt() or tables to one level", () => {
    const { design: flat, notes: flatNotes } = designFromScript('image("a.png")\nnotification("hi")\n', {});
    expect(flat.levels).toHaveLength(1);
    expect(flat.levels[0].actions).toEqual([
      { kind: "image", file: "a.png" },
      { kind: "notification", text: "hi" },
    ]);
    expect(flatNotes.join(" ")).toContain("single level");
  });

  it("drops parameterized multi-API wrappers instead of converting their bodies", () => {
    const { design, notes } = designFromScript(
      [
        'require("edgeware_v0")',
        "function multiple_popups(chance, number)",
        "  while spawned < number do",
        "    if roll(chance) then",
        '      image("leak.png")',
        "    else",
        '      video("leak.mp4")',
        "    end",
        "    spawned = spawned + 1",
        "  end",
        "end",
        "corrupt()",
        "multiple_popups(95, 3)",
        "multiple_popups(90, 2)",
        "",
      ].join("\n"),
      {}
    );
    const json = JSON.stringify(design.levels);
    expect(json).not.toContain("leak.png");
    expect(json).not.toContain("leak.mp4");
    const report = notes.join(" ");
    expect(report).toContain("2 multiple_popups() call(s) dropped");
    expect(report).toContain("2 helper call(s) with computed arguments dropped");
  });

  it("bounds conversion work on pathologically nested scripts", () => {
    const depth = 20000;
    const lua = "image(" .repeat(depth) + '"x.png"' + ")".repeat(depth);
    const started = Date.now();
    const { notes } = designFromScript(lua, {});
    expect(Date.now() - started).toBeLessThan(2000);
    expect(notes.join(" ")).toContain("scan budget");
  });

  it("survives an empty script", () => {
    const { design: empty } = designFromScript("", {});
    expect(empty.levels).toHaveLength(1);
    expect(empty.levels[0].actions).toEqual([]);
  });
});
