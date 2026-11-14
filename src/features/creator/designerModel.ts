/**
 * @file designerModel — The no-code corruption script design and its
 * generated artifacts.
 *
 * A design is an ordered list of levels. Each level activates/deactivates
 * moods, may set a wallpaper, shows optional content, and defines how the
 * next level is reached (after a delay, when an audio file ends, or never).
 * Saving a design writes two coordinated files into the pack:
 *  - script.lua: drives the sequence at runtime and embeds this design as a
 *    JSON block comment, so the designer can reopen and edit it losslessly;
 *  - corruption.json: the level → mood/wallpaper tables the runtime applies
 *    on every corrupt() transition (also usable by the auto drivers).
 */

export type DesignerAdvance =
  | { mode: "time"; seconds: number }
  | { mode: "audio"; file: string }
  | { mode: "end" };

export type DesignerActionKind =
  | "image"
  | "video"
  | "audio"
  | "notification"
  | "prompt"
  | "subliminal"
  | "web"
  | "close_popups"
  | "set_close_text";

export interface DesignerAction {
  kind: DesignerActionKind;
  /** Media file for image/video/audio actions (pack-relative name). */
  file?: string;
  /** Text for notification/prompt/subliminal/web/close-label actions. */
  text?: string;
  /** When set (1-99), the action only fires with this percent chance. */
  chance?: number;
  /**
   * When set, the action fires this many ms after the level starts instead
   * of immediately — how converted scripts keep the original's staggered
   * `after(ms, function() … end)` sequencing.
   */
  delayMs?: number;
  /**
   * Fires when the PREVIOUS action completes (audio: when its playback
   * ends) instead of at level start — how converted scripts keep the
   * original's `audio(file, next)` callback chains sequential.
   */
  afterPrevious?: boolean;
}

export interface DesignerLevel {
  addMoods: string[];
  removeMoods: string[];
  /**
   * Wallpaper file, pack-root-relative. A bare name lives in img/ (the
   * designer picker's world); a value containing "/" points elsewhere in the
   * pack (legacy packs keep wallpapers at the pack root).
   */
  wallpaper: string | null;
  actions: DesignerAction[];
  advance: DesignerAdvance;
  /**
   * Settings this level overrides while active (applied at the transition,
   * only when the user granted corruption config permission).
   */
  config: { popupMod?: number; delay?: number };
}

export interface DesignerScript {
  version: 1;
  /** Delay before the first level runs, seconds. */
  startDelaySeconds: number;
  levels: DesignerLevel[];
}

export const DESIGNER_MARKER = "-- [EDGWARE-DESIGNER]";

// Bounds a hostile (hand-planted) marker cannot push the renderer into
// rendering thousands of cards or the writer past the file caps.
export const MAX_DESIGN_LEVELS = 200;
const MAX_ACTIONS_PER_LEVEL = 50;
const MAX_MOODS_PER_LEVEL = 100;
const MAX_LUA_DELAY_MS = 2_147_483_647;

export function emptyDesign(): DesignerScript {
  return { version: 1, startDelaySeconds: 2, levels: [] };
}

function clampMs(ms: number): number {
  // A delay that overflows to +Infinity means "absurdly long", not "now".
  if (ms === Number.POSITIVE_INFINITY) return MAX_LUA_DELAY_MS;
  if (!Number.isFinite(ms)) return 0;
  return Math.min(MAX_LUA_DELAY_MS, Math.max(0, Math.round(ms)));
}

function luaString(value: string): string {
  return (
    `"${value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/\t/g, "\\t")
      // Control characters cannot appear in a Lua string literal.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")}"`
  );
}

function actionCall(action: DesignerLevel["actions"][number]): string | null {
  switch (action.kind) {
    case "image":
      return action.file ? `image(${luaString(action.file)})` : "image(nil)";
    case "video":
      return action.file ? `video(${luaString(action.file)})` : "video(nil)";
    case "audio":
      return action.file ? `audio(${luaString(action.file)})` : "audio(nil)";
    case "notification":
      return action.text ? `notification(${luaString(action.text)})` : "notification()";
    case "prompt":
      return action.text ? `prompt(${luaString(action.text)})` : "prompt()";
    case "subliminal":
      return action.text ? `subliminal(${luaString(action.text)})` : "subliminal()";
    case "web":
      return action.text ? `web(${luaString(action.text)})` : null;
    case "close_popups":
      return "close_popups()";
    case "set_close_text":
      return action.text ? `set_popup_close_text(${luaString(action.text)})` : null;
  }
}

function indentLines(lines: string[]): string[] {
  return lines.map((l) => `  ${l}`);
}

/**
 * Render one action as lua lines (no level-body indent). `children` are the
 * actions that run when THIS action completes: for audio they become the
 * on_stop callback — exactly the original script's `audio(file, next)`
 * chain. Non-audio actions cannot host a callback, so children continue as
 * plain siblings.
 */
function renderAction(action: DesignerAction, children: string[]): string[] | null {
  const call = actionCall(action);
  if (!call) return null;
  let lines: string[];
  if (children.length > 0 && action.kind === "audio") {
    lines = [
      `audio(${action.file ? luaString(action.file) : "nil"}, function()`,
      ...indentLines(children),
      "end)",
    ];
  } else if (children.length > 0) {
    lines = [call, ...children];
  } else {
    lines = [call];
  }
  if (action.chance !== undefined && action.chance >= 1 && action.chance <= 99) {
    lines = [`if roll(${Math.round(action.chance)}) then`, ...indentLines(lines), "end"];
  }
  // A delayed action keeps the original script's staggered timing: it fires
  // inside after(ms, …) instead of synchronously. The chance roll happens
  // when it fires, not when it is scheduled.
  if (action.delayMs !== undefined && action.delayMs > 0) {
    lines = [`after(${clampMs(action.delayMs)}, function()`, ...indentLines(lines), "end)"];
  }
  return lines;
}

/**
 * Render a level's action statements. Consecutive `afterPrevious` actions
 * nest inside the completion callback of the audio before them (sequential
 * voice chains). `finalCallback` (the advance to the next level) is placed
 * at the completion of the action at `attachIdx` — the audio whose end
 * drives the transition — instead of replaying that audio in parallel;
 * pass -1 to append it nowhere (the caller emits its own advance line).
 */
function renderLevelActions(
  actions: DesignerAction[],
  finalCallback: string[] | null,
  attachIdx: number
): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < actions.length) {
    const run = [actions[i]];
    const runStart = i;
    let j = i + 1;
    while (j < actions.length && actions[j].afterPrevious) {
      run.push(actions[j]);
      j++;
    }
    const attachInRun = finalCallback !== null && attachIdx >= runStart && attachIdx < j;
    let childLines: string[] | null = null;
    for (let k = j - 1; k >= runStart; k--) {
      if (attachInRun && k === attachIdx) {
        childLines = [...(childLines ?? []), ...finalCallback!];
      }
      const rendered = renderAction(actions[k], childLines ?? []);
      if (rendered) childLines = rendered;
    }
    if (childLines) out.push(...indentLines(childLines));
    i = j;
  }
  return out;
}

export function generateLua(design: DesignerScript): string {
  const lines: string[] = [
    `${DESIGNER_MARKER}${JSON.stringify(design)}`,
    "-- Generated by the Edgeware++ script designer.",
    "-- Edit the design in the app. Manual edits outside the marker block are kept only on the code tab.",
    'require("edgeware_v0")',
    "",
  ];

  const n = design.levels.length;
  if (n === 0) {
    lines.push('-- No levels designed yet. Add one in the script designer.');
    return lines.join("\n") + "\n";
  }

  for (let i = n; i >= 1; i--) {
    lines.push(`local function level${i}()`);
    lines.push("  corrupt()");
    const level = design.levels[i - 1];
    const advance = level.advance;
    // When the advance audio is also one of the level's actions (the norm
    // for converted chains), the next level nests inside that action's
    // completion instead of replaying the audio in parallel.
    let advanceIdx = -1;
    if (i < n && advance.mode === "audio") {
      for (let k = level.actions.length - 1; k >= 0; k--) {
        const a = level.actions[k];
        if (a.kind === "audio" && a.file === advance.file) {
          advanceIdx = k;
          break;
        }
      }
    }
    lines.push(
      ...renderLevelActions(
        level.actions,
        advanceIdx >= 0 ? [`level${i + 1}()`] : null,
        advanceIdx
      )
    );
    if (i === n || advance.mode === "end") {
      lines.push("  -- final level of this design");
      lines.push("end");
    } else if (advance.mode === "audio") {
      if (advanceIdx < 0) {
        lines.push(`  audio(${luaString(advance.file)}, function() level${i + 1}() end)`);
      }
      lines.push("end");
    } else {
      lines.push(`  after(${clampMs(advance.seconds * 1000)}, level${i + 1})`);
      lines.push("end");
    }
    lines.push("");
  }
  lines.push(`after(${clampMs(design.startDelaySeconds * 1000)}, level1)`);
  return lines.join("\n") + "\n";
}

/**
 * The last level of a design never chains onward; normalize a stale advance
 * (e.g. one left in a hostile marker block) so the saved artifacts and the
 * editor agree with what the UI shows.
 */
export function normalizeDesign(design: DesignerScript): DesignerScript {
  if (design.levels.length === 0) return design;
  const levels = design.levels.map((l, i) =>
    i === design.levels.length - 1 ? { ...l, advance: { mode: "end" as const } } : l
  );
  return { ...design, levels };
}

/**
 * The mood set active at each level, applying add/remove in level order
 * (a session starts from no moods). Index-aligned with design.levels;
 * surfaces where a mood is active without the designer re-stating it.
 */
export function activeMoodsByLevel(design: DesignerScript): string[][] {
  const active = new Set<string>();
  return design.levels.map((level) => {
    for (const mood of level.addMoods) active.add(mood);
    for (const mood of level.removeMoods) active.delete(mood);
    return [...active];
  });
}

/**
 * Whether a wallpaper reference resolves inside the pack, mirroring the
 * runtime's pack-root-relative resolution: a bare name lives in img/, a
 * "./name" is a pack-root file, an explicit "img/..." names the img/ dir;
 * any other directory is a deliberate pack path the gallery cannot see.
 */
export function wallpaperRefResolves(
  ref: string,
  imgFiles: string[],
  rootFiles: string[]
): boolean {
  const img = new Set(imgFiles);
  const root = new Set(rootFiles);
  if (ref.startsWith("./")) return root.has(ref.slice(2));
  if (ref.startsWith("img/")) return img.has(ref.slice(4));
  if (ref.includes("/")) return true;
  return img.has(ref);
}

export function generateCorruptionJson(design: DesignerScript): string {
  const moods: Record<string, { add: string[]; remove: string[]; wallpaper?: string }> = {};
  const levelConfig: Record<string, Record<string, number>> = {};
  for (let i = 0; i < design.levels.length; i++) {
    const level = design.levels[i];
    const entry: { add: string[]; remove: string[]; wallpaper?: string } = {
      add: level.addMoods,
      remove: level.removeMoods,
    };
    // Wallpapers are stored pack-root-relative: a bare name lives in img/
    // (the designer picker's world), a path with a directory points elsewhere
    // in the pack (legacy packs keep wallpapers at the pack root).
    if (level.wallpaper)
      entry.wallpaper = level.wallpaper.includes("/") ? level.wallpaper : `img/${level.wallpaper}`;
    moods[String(i + 1)] = entry;
    const config = level.config ?? {};
    if (config.popupMod !== undefined || config.delay !== undefined) {
      levelConfig[String(i + 1)] = {
        ...(config.popupMod !== undefined ? { popupMod: config.popupMod } : {}),
        ...(config.delay !== undefined ? { delay: config.delay } : {}),
      };
    }
  }
  return JSON.stringify({ moods, config: levelConfig }, null, 2);
}

/**
 * Mood renames and removals must reach every artifact that names moods:
 * the design embedded in script.lua and the corruption.json level tables.
 * These helpers are pure so the main process can apply them on disk.
 */

/** Rewrite mood names inside a design (rename: from→to; remove: to=""). */
export function renameMoodInDesign(design: DesignerScript, from: string, to: string): DesignerScript {
  const map = (list: string[]): string[] =>
    list
      .map((m) => (m === from ? to : m))
      .filter((m) => m !== "");
  return {
    ...design,
    levels: design.levels.map((l) => ({
      ...l,
      addMoods: [...new Set(map(l.addMoods))],
      removeMoods: [...new Set(map(l.removeMoods))],
    })),
  };
}

/**
 * Rewrite mood names in a parsed corruption.json object's level tables.
 * Unknown shapes pass through unchanged.
 */
export function renameMoodInCorruption<T>(parsed: T, from: string, to: string): T {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as Record<string, unknown>;
  const moods = root.moods;
  // Only the object-keyed-by-level shape is understood; arrays and other
  // exotic tables are left byte-for-byte alone rather than reshaped.
  if (!moods || typeof moods !== "object" || Array.isArray(moods)) return parsed;
  const map = (list: unknown): unknown =>
    Array.isArray(list)
      ? [...new Set(list.map((m) => (m === from ? to : m)).filter((m) => m !== ""))]
      : list;
  const next: Record<string, unknown> = {};
  for (const [level, entry] of Object.entries(moods as Record<string, unknown>)) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const rec = entry as Record<string, unknown>;
      next[level] = { ...rec, add: map(rec.add), remove: map(rec.remove) };
    } else {
      next[level] = entry;
    }
  }
  return { ...root, moods: next } as T;
}

/**
 * Replace the design embedded in a generated script's marker line.
 * Returns the input unchanged when the script carries no (valid) marker.
 */
export function replaceDesignInScript(lua: string, design: DesignerScript): string {
  if (parseDesignerScript(lua) === null) return lua;
  const marker = `${DESIGNER_MARKER}${JSON.stringify(design)}`;
  return lua
    .split("\n")
    .map((line) => (line.startsWith(DESIGNER_MARKER) ? marker : line))
    .join("\n");
}

export function parseDesignerScript(lua: string): DesignerScript | null {
  const line = lua.split("\n").find((l) => l.startsWith(DESIGNER_MARKER));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice(DESIGNER_MARKER.length)) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as DesignerScript).version === 1 &&
      Array.isArray((parsed as DesignerScript).levels)
    ) {
      return sanitizeDesign(parsed as DesignerScript);
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizeDesign(design: DesignerScript): DesignerScript {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    version: 1,
    startDelaySeconds: Number.isFinite(design.startDelaySeconds) ? design.startDelaySeconds : 2,
    levels: design.levels.slice(0, MAX_DESIGN_LEVELS).map((level) => {
      const advance = level?.advance;
      const mode = advance?.mode;
      const rawConfig = (level?.config ?? {}) as Record<string, unknown>;
      const num = (v: unknown): number | undefined =>
        typeof v === "number" && Number.isFinite(v) ? v : undefined;
      return {
        addMoods: list(level?.addMoods).slice(0, MAX_MOODS_PER_LEVEL),
        removeMoods: list(level?.removeMoods).slice(0, MAX_MOODS_PER_LEVEL),
        wallpaper: typeof level?.wallpaper === "string" && level.wallpaper ? level.wallpaper : null,
        config: { popupMod: num(rawConfig.popupMod), delay: num(rawConfig.delay) },
        actions: (Array.isArray(level?.actions) ? (level.actions as DesignerAction[]) : [])
          .filter(
            (a) =>
              a &&
              [
                "image",
                "video",
                "audio",
                "notification",
                "prompt",
                "subliminal",
                "web",
                "close_popups",
                "set_close_text",
              ].includes(a.kind)
          )
          .slice(0, MAX_ACTIONS_PER_LEVEL)
          .map((a) => {
            // Rebuild from known fields only: unknown keys (and hostile
            // __proto__ entries) never survive a round-trip, and file/text
            // must be strings or luaString throws on save.
            const chance =
              typeof a.chance === "number" && Number.isFinite(a.chance)
                ? Math.min(99, Math.max(1, Math.round(a.chance)))
                : undefined;
            const clean: DesignerAction = { kind: a.kind };
            if (typeof a.file === "string" && a.file) clean.file = a.file;
            if (typeof a.text === "string" && a.text) clean.text = a.text;
            if (a.chance !== undefined && chance !== undefined) clean.chance = chance;
            const delayMs =
              typeof a.delayMs === "number" && Number.isFinite(a.delayMs) && a.delayMs > 0
                ? Math.min(MAX_LUA_DELAY_MS, Math.round(a.delayMs))
                : undefined;
            if (delayMs !== undefined) clean.delayMs = delayMs;
            if (a.afterPrevious === true) clean.afterPrevious = true;
            return clean;
          }),
        advance:
          mode === "audio" && advance.file
            ? { mode: "audio", file: str(advance.file) }
            : mode === "end"
              ? { mode: "end" }
              : (() => {
                  const seconds = (advance as { seconds?: unknown } | undefined)?.seconds;
                  return { mode: "time" as const, seconds: typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 10 };
                })(),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/*  Hand-written script conversion                                     */
/* ------------------------------------------------------------------ */

/** Outcome of converting a hand-written pack script into a design. */
export interface ConversionResult {
  design: DesignerScript;
  /** What was preserved, flattened or dropped — shown to the user. */
  notes: string[];
}

const API_CALL_NAMES = [
  "image",
  "video",
  "audio",
  "notification",
  "prompt",
  "subliminal",
  "web",
  "close_popups",
  "set_popup_close_text",
] as const;

const API_KIND_BY_NAME: Record<string, DesignerActionKind> = {
  image: "image",
  video: "video",
  audio: "audio",
  notification: "notification",
  prompt: "prompt",
  subliminal: "subliminal",
  web: "web",
  close_popups: "close_popups",
  set_popup_close_text: "set_close_text",
};

/** Blank Lua comments while preserving line structure and string literals. */
function blankComments(lua: string): string {
  const out: string[] = [];
  let i = 0;
  const n = lua.length;
  while (i < n) {
    const ch = lua[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out.push(ch);
      i++;
      while (i < n) {
        if (lua[i] === "\\" && i + 1 < n) {
          out.push(lua[i], lua[i + 1]);
          i += 2;
          continue;
        }
        out.push(lua[i]);
        i++;
        if (lua[i - 1] === quote) break;
      }
      continue;
    }
    if (ch === "-" && lua[i + 1] === "-") {
      if (lua.startsWith("--[[", i)) {
        const end = lua.indexOf("]]", i + 4);
        const stop = end === -1 ? n : end + 2;
        for (const c of lua.slice(i, stop)) out.push(c === "\n" ? "\n" : " ");
        i = stop;
        continue;
      }
      while (i < n && lua[i] !== "\n") {
        out.push(" ");
        i++;
      }
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

/** Read a Lua string literal starting at the quote; returns value and end. */
function readLuaString(src: string, start: number): { value: string; end: number } | null {
  const quote = src[start];
  if (quote !== '"' && quote !== "'") return null;
  let value = "";
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) {
      const esc = src[i + 1];
      value += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
      i += 2;
      continue;
    }
    if (ch === quote) return { value, end: i + 1 };
    value += ch;
    i++;
  }
  return null;
}

/**
 * Scan a balanced call starting at the "(" index; returns the inner argument
 * text and the index just past the closing ")".
 */
function scanCallArgs(code: string, openIdx: number): { args: string; end: number } | null {
  let depth = 0;
  let i = openIdx;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      const str = readLuaString(code, i);
      if (!str) return null;
      i = str.end;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return { args: code.slice(openIdx + 1, i), end: i + 1 };
    }
    i++;
  }
  return null;
}

/** Split an argument list at top-level commas (strings/parens/braces aware). */
function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let i = 0;
  while (i < args.length) {
    const ch = args[i];
    if (ch === '"' || ch === "'") {
      const str = readLuaString(args, i);
      if (str) {
        cur += args.slice(i, str.end);
        i = str.end;
        continue;
      }
    }
    if (ch === "(" || ch === "{") depth++;
    if (ch === ")" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  parts.push(cur);
  return parts;
}

/** First string literal inside a text, or null. */
function firstLiteral(src: string): string | null {
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '"' || src[i] === "'") {
      const str = readLuaString(src, i);
      if (str) return str.value;
    }
  }
  return null;
}

interface ScannedCall {
  kind: DesignerActionKind;
  /** Literal first argument (media file or text), if any. */
  literal: string | null;
  /** True when the call passes a second argument (callback/chaining). */
  chained: boolean;
  chance?: number;
  /** Offset from level start when wrapped in after(ms, …). */
  delayMs?: number;
  /** Position in the comment-blanked source. */
  pos: number;
}

/** Span of `function <name>(...) … end`, or null when not defined. */
function functionBodySpan(code: string, name: string): { start: number; end: number } | null {
  const def = new RegExp(`\\bfunction\\s+${name}\\s*\\(`);
  const m = def.exec(code);
  if (!m) return null;
  // Lua blocks nest under one `end` each: function/then/do/repeat open,
  // elseif borrows its `then` (so it self-corrects), end/until close.
  let depth = 0;
  const re = /\b(function|then|do|elseif|end|repeat|until)\b/g;
  re.lastIndex = m.index;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code))) {
    if (match[0] === "function" || match[0] === "then" || match[0] === "do" || match[0] === "repeat") {
      depth += 1;
    } else if (match[0] === "elseif") {
      depth -= 1; // the matching `then` re-adds it
    } else {
      depth -= 1; // end | until
      if (depth === 0) return { start: m.index, end: match.index + match[0].length };
    }
  }
  return null;
}

/**
 * Convert a hand-written pack script plus its corruption.json tables into an
 * editable design.
 *
 * Level structure (moods, config overrides, wallpapers) is taken from the
 * tables — they are the runtime truth. Popup actions are recovered by a
 * literal scan of the script: direct API calls and script-local helpers that
 * wrap exactly one API call (e.g. `delayed_audio` → audio) are converted in
 * textual order, split at each `corrupt()` occurrence. Control flow that the
 * design model cannot express (loops, roll() with computed chances, bulk
 * spawners, callback chains, API redefinitions) is reported, never guessed.
 */
export function designFromScript(lua: string, corruption: unknown): ConversionResult {
  const notes: string[] = [];
  const code = blankComments(lua);

  /* ---- level skeleton from the corruption tables ---- */
  const root = (corruption && typeof corruption === "object" ? corruption : {}) as Record<
    string,
    unknown
  >;
  const moodsRaw = (root.moods ?? {}) as Record<string, Record<string, unknown>>;
  const configRaw = (root.config ?? {}) as Record<string, Record<string, unknown>>;
  const wallpapersRaw = (root.wallpapers ?? {}) as Record<string, unknown>;
  const tableLevels = new Set<number>();
  for (const src of [moodsRaw, configRaw]) {
    for (const key of Object.keys(src)) {
      const lvl = parseInt(key, 10);
      if (Number.isFinite(lvl) && lvl >= 1) tableLevels.add(lvl);
    }
  }
  for (const key of Object.keys(wallpapersRaw)) {
    const lvl = parseInt(key, 10);
    if (Number.isFinite(lvl) && lvl >= 1) tableLevels.add(lvl);
  }

  /* ---- split the script at corrupt() occurrences ---- */
  const corruptRe = /\bcorrupt\s*\(\s*\)/g;
  const corruptAt: number[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = corruptRe.exec(code))) corruptAt.push(cm.index);
  const corruptCount = corruptAt.length;

  const maxLevel = Math.max(corruptCount, ...[0, ...tableLevels]);
  const levelCount =
    corruptCount === 0 && tableLevels.size === 0 ? 1 : Math.min(maxLevel, MAX_DESIGN_LEVELS);
  if (maxLevel > MAX_DESIGN_LEVELS) {
    notes.push(`Design capped at ${MAX_DESIGN_LEVELS} levels. The script implies ${maxLevel}.`);
  }
  if (corruptCount !== tableLevels.size && corruptCount > 0 && tableLevels.size > 0) {
    notes.push(
      `The script calls corrupt() ${corruptCount} time(s) but the pack tables define ${tableLevels.size} level(s). The design uses ${maxLevel}.`
    );
  }

  /* ---- scan API calls (direct + single-API script-local helpers) ---- */
  const definedFns = new Set<string>();
  const fnRe = /\bfunction\s+([A-Za-z_]\w*)\s*\(/g;
  let fm: RegExpExecArray | null;
  while ((fm = fnRe.exec(code))) definedFns.add(fm[1]);

  const redefined = new Set<string>();
  for (const name of API_CALL_NAMES) {
    if (new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(code)) redefined.add(name);
  }

  // Definitions of helpers and API wrappers are implementation, not usage:
  // calls inside them must not be extracted as actions.
  const definitionSpans: Array<{ start: number; end: number }> = [];
  for (const name of [...redefined]) {
    const span = functionBodySpan(code, name);
    if (span) definitionSpans.push(span);
  }

  const helperApi = new Map<string, DesignerActionKind>();
  const helperLiteral = new Map<string, string | null>();
  // Helpers whose single API call is wrapped in after(<param>, …) take their
  // delay from the call-site argument bound to that parameter
  // (delayed_audio(1000, "Voice.mp3", cb) → audio delayed by 1000 ms).
  const helperDelayArg = new Map<string, number>();
  const complexHelpers = new Set<string>();
  for (const name of definedFns) {
    if ((API_CALL_NAMES as readonly string[]).includes(name) || name === "corrupt") continue;
    // A wrapper is called WITH arguments somewhere. Functions used only as
    // callbacks or kicked off empty (voice_7(), binaural_audio) are chain
    // links: their bodies are scanned as ordinary usage, in place.
    const argCallSites = (code.match(new RegExp(`\\b${name}\\s*\\(\\s*[^)\\s]`, "g")) ?? []).length;
    if (argCallSites < 2) continue;
    const span = functionBodySpan(code, name);
    const body = span ? code.slice(span.start, span.end) : "";
    const inner = [...body.matchAll(new RegExp(`\\b(${API_CALL_NAMES.join("|")})\\s*\\(`, "g"))];
    const kinds = new Set(inner.map((m) => API_KIND_BY_NAME[m[1]]));
    if (kinds.size === 1 && span) {
      helperApi.set(name, API_KIND_BY_NAME[inner[0][1]]);
      helperLiteral.set(name, firstLiteral(body));
      const params = /^function\s+\w+\s*\(([^)]*)\)/.exec(body)?.[1];
      const afterParam = /\bafter\(\s*([A-Za-z_]\w*)\s*,/.exec(body)?.[1];
      if (params && afterParam) {
        const idx = params
          .split(",")
          .map((p) => p.trim())
          .indexOf(afterParam);
        if (idx >= 0) helperDelayArg.set(name, idx);
      }
      definitionSpans.push(span);
    } else if (kinds.size > 1 && span) {
      // A parameterized wrapper around SEVERAL APIs (bulk spawners) has no
      // design equivalent: its body is implementation, not usage, and its
      // calls are reported as dropped.
      definitionSpans.push(span);
      complexHelpers.add(name);
    }
  }
  const insideDefinition = (pos: number): boolean =>
    definitionSpans.some((d) => pos >= d.start && pos < d.end);

  // Spans of every script-local function: a call inside a function that an
  // earlier audio named as its on_stop callback belongs to that chain.
  const fnSpans: Array<{ name: string; start: number; end: number }> = [];
  for (const name of definedFns) {
    const span = functionBodySpan(code, name);
    if (span) fnSpans.push({ name, ...span });
  }
  const innermostFnAt = (pos: number): string | null => {
    let best: { name: string; size: number } | null = null;
    for (const f of fnSpans) {
      if (pos > f.start && pos < f.end) {
        const size = f.end - f.start;
        if (!best || size < best.size) best = { name: f.name, size };
      }
    }
    return best?.name ?? null;
  };
  // Functions named as an audio call's on_stop callback (directly, or via
  // after(ms, fn) inside an anonymous callback): their bodies run when that
  // audio ends, so their actions become sequential chain links.
  const chainTargets = new Set<string>();
  const pendingDelay = new Map<string, number>();
  const pendingApplied = new Set<string>();

  // Spans of after(<ms>, …) calls with a literal delay: API calls inside
  // them fire at that offset from the enclosing scope, and the design keeps
  // the stagger by carrying the delay on the action.
  // Deeply nested calls make the balanced-paren scan quadratic; a hostile
  // 200 KB script must not freeze the main process.
  const SCAN_WORK_BUDGET = 4_000_000;
  interface AfterSpan {
    ms: number;
    start: number;
    end: number;
  }
  const afterSpans: AfterSpan[] = [];
  {
    const afterScanRe = /\bafter\s*\(/g;
    let aspm: RegExpExecArray | null;
    let spanWork = 0;
    while ((aspm = afterScanRe.exec(code))) {
      const openIdx = aspm.index + aspm[0].length - 1;
      const scanned = scanCallArgs(code, openIdx);
      if (!scanned) continue;
      spanWork += scanned.end - openIdx;
      if (spanWork > SCAN_WORK_BUDGET) break;
      const first = (splitArgs(scanned.args)[0] ?? "").trim();
      if (!/^\d+$/.test(first)) continue;
      afterSpans.push({ ms: Number(first), start: aspm.index, end: scanned.end });
    }
  }
  const delayForPos = (pos: number): number | undefined => {
    let best: AfterSpan | undefined;
    for (const s of afterSpans) {
      if (pos >= s.start && pos < s.end && (!best || s.end - s.start < best.end - best.start)) {
        best = s;
      }
    }
    return best?.ms;
  };

  const calls: ScannedCall[] = [];
  let scanWork = 0;
  let scanBudgetHit = false;
  let droppedRandomWeb = 0;
  let droppedBulk = 0;
  let droppedHelpers = 0;
  let chainedCalls = 0;
  let computedRolls = 0;
  let delayedActions = 0;
  let chainedLinks = 0;

  const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
  let callm: RegExpExecArray | null;
  while ((callm = callRe.exec(code))) {
    const name = callm[1];
    const openIdx = callm.index + callm[0].length - 1;
    const before = code.slice(Math.max(0, callm.index - 20), callm.index);
    if (/\bfunction\s+$/.test(before)) continue;
    if (insideDefinition(callm.index)) continue;
    let kind: DesignerActionKind | null = null;
    let argsText = "";
    if ((API_CALL_NAMES as readonly string[]).includes(name)) {
      kind = API_KIND_BY_NAME[name];
    } else if (helperApi.has(name)) {
      kind = helperApi.get(name)!;
    } else {
      continue;
    }
    const scanned = scanCallArgs(code, openIdx);
    if (!scanned) continue;
    scanWork += scanned.end - openIdx;
    if (scanWork > SCAN_WORK_BUDGET) {
      scanBudgetHit = true;
      break;
    }
    argsText = scanned.args;
    const parts = splitArgs(argsText);
    const first = (parts[0] ?? "").trim();
    let literal: string | null = null;
    if (helperApi.has(name)) {
      // A helper's payload may sit in any argument (delayed_audio(ms, file,
      // cb)); fall back to the literal pinned in the helper's own body
      // (binaural_audio() → audio("binaural.wav", ...)).
      literal =
        parts.map((a) => a.trim()).find((a) => a.startsWith('"') || a.startsWith("'")) !== undefined
          ? firstLiteral(argsText)
          : helperLiteral.get(name) ?? null;
      if (literal === null) droppedHelpers++;
    } else if (first.startsWith('"') || first.startsWith("'")) {
      const str = readLuaString(first, 0);
      literal = str ? str.value : null;
    }
    // Direct calls with a nil or computed first argument carry no literal.
    const chained = parts.length > 1 && (parts[1] ?? "").trim() !== "";
    if (chained) chainedCalls++;
    if (kind === "web" && literal === null) droppedRandomWeb++;

    // roll(N) guard on the call's line or the one or two lines above it.
    let chance: number | undefined;
    {
      let pos = callm.index;
      for (let back = 0; back < 3; back++) {
        const probe = back === 0 ? pos : pos - 2;
        if (probe < 0) break;
        const lineStart = code.lastIndexOf("\n", probe) + 1;
        const lineEnd = code.indexOf("\n", lineStart);
        const line = code.slice(lineStart, lineEnd === -1 ? code.length : lineEnd);
        const rollMatch = /^\s*if\s+roll\((\d+)\)\s+then\b/.exec(line);
        if (rollMatch) {
          chance = Number(rollMatch[1]);
          break;
        }
        pos = lineStart;
        if (pos === 0) break;
      }
    }

    // Intra-level stagger: an enclosing after(ms, …) span, or a helper whose
    // single API is wrapped in after(<param>, …) with a literal call argument.
    let delayMs: number | undefined;
    if (helperApi.has(name)) {
      const dIdx = helperDelayArg.get(name);
      const raw = dIdx === undefined ? "" : (parts[dIdx] ?? "").trim();
      if (/^\d+$/.test(raw)) delayMs = Number(raw);
    }
    if (delayMs === undefined) delayMs = delayForPos(callm.index);

    // Sequential voice chains: an audio's callback argument names the
    // function that runs when playback ends.
    if (kind === "audio") {
      const argTexts = parts.slice(1).map((p) => p.trim());
      const cbName = argTexts.find((p) => definedFns.has(p));
      if (cbName) {
        chainTargets.add(cbName);
      } else {
        const anon = argTexts.find((p) => p.includes("function"));
        if (anon) {
          const delayed = /\bafter\(\s*(\d+)\s*,\s*([A-Za-z_]\w*)\s*\)/.exec(anon);
          const bare = /\b([A-Za-z_]\w*)\s*\(\s*\)/.exec(anon);
          const ref = delayed?.[2] ?? bare?.[1];
          if (
            ref &&
            definedFns.has(ref) &&
            !(API_CALL_NAMES as readonly string[]).includes(ref)
          ) {
            chainTargets.add(ref);
            if (delayed) pendingDelay.set(ref, Number(delayed[1]));
          }
        }
      }
    }

    calls.push({ kind, literal, chained, chance, delayMs, pos: callm.index });
  }

  // Call sites only: a script-local definition of the spawner is not a call.
  const bulkCalls = (code.match(/\bmultiple_popups\s*\(/g) ?? []).length;
  const bulkDefs = (code.match(/\bfunction\s+multiple_popups\s*\(/g) ?? []).length;
  droppedBulk = Math.max(0, bulkCalls - bulkDefs);
  for (const name of complexHelpers) {
    const callRe = new RegExp(`\\b${name}\\s*\\(\\s*[^)\\s]`, "g");
    const defRe = new RegExp(`\\bfunction\\s+${name}\\s*\\(\\s*[^)\\s]`, "g");
    droppedHelpers += Math.max(0, (code.match(callRe) ?? []).length - (code.match(defRe) ?? []).length);
  }
  const computedRollRe = /\broll\(\s*[^)\d\s]/g;
  computedRolls = (code.match(computedRollRe) ?? []).length;

  /* ---- assign calls to levels by corrupt() position ---- */
  const segOf = (pos: number): number => {
    let seg = 0;
    for (const at of corruptAt) if (pos > at) seg++;
    return seg;
  };

  const levels: DesignerLevel[] = [];
  for (let lvl = 1; lvl <= levelCount; lvl++) {
    const key = String(lvl);
    const moodEntry = moodsRaw[key] ?? {};
    // Designer tables store "img/<file>"; the legacy wallpapers map is
    // pack-root-relative, so a bare name there means a file at the pack root
    // ("./x.png" keeps it out of the designer's img/ convention).
    const legacyWallpaper = (v: string): string => (v.includes("/") ? v : `./${v}`);
    const tableWallpaper =
      typeof moodEntry.wallpaper === "string" && moodEntry.wallpaper
        ? moodEntry.wallpaper.startsWith("img/")
          ? moodEntry.wallpaper.slice(4)
          : moodEntry.wallpaper
        : typeof wallpapersRaw[key] === "string" && wallpapersRaw[key]
          ? legacyWallpaper(wallpapersRaw[key] as string)
          : lvl === 1 && typeof wallpapersRaw["default"] === "string" && wallpapersRaw["default"]
            ? legacyWallpaper(wallpapersRaw["default"] as string)
            : null;
    const cfg = configRaw[key] ?? {};
    const num = (v: unknown): number | undefined =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;
    levels.push({
      addMoods: Array.isArray(moodEntry.add) ? (moodEntry.add as string[]) : [],
      removeMoods: Array.isArray(moodEntry.remove) ? (moodEntry.remove as string[]) : [],
      wallpaper: tableWallpaper,
      actions: [],
      advance: lvl === levelCount ? { mode: "end" } : { mode: "time", seconds: 10 },
      config: { popupMod: num(cfg.popupMod), delay: num(cfg.delay) },
    });
  }

  let preFirstCorrupt = 0;
  for (const call of calls) {
    const seg = segOf(call.pos);
    const lvl = seg === 0 ? 1 : seg;
    if (lvl > levelCount) continue;
    if (seg === 0) preFirstCorrupt++;
    const target = levels[lvl - 1];
    if (target.actions.length >= MAX_ACTIONS_PER_LEVEL) continue;
    if (call.kind === "web" && call.literal === null) continue;
    const action: DesignerAction = { kind: call.kind };
    if (call.kind === "image" || call.kind === "video" || call.kind === "audio") {
      if (call.literal) action.file = call.literal;
    } else if (call.kind !== "close_popups") {
      if (call.literal) action.text = call.literal;
    }
    if (call.chance !== undefined) action.chance = Math.min(99, Math.max(1, call.chance));
    if (call.delayMs !== undefined && call.delayMs > 0) {
      action.delayMs = Math.min(MAX_LUA_DELAY_MS, Math.round(call.delayMs));
      delayedActions++;
    }
    // Chain link: this call lives inside a function some earlier audio
    // named as its on_stop callback, so it plays when that audio ends.
    const host = innermostFnAt(call.pos);
    if (host && chainTargets.has(host)) {
      action.afterPrevious = true;
      chainedLinks++;
      const pd = pendingDelay.get(host);
      if (pd !== undefined && !pendingApplied.has(host) && pd > 0) {
        pendingApplied.add(host);
        action.delayMs = Math.min(MAX_LUA_DELAY_MS, Math.max(action.delayMs ?? 0, pd));
      }
    }
    target.actions.push(action);

    // Advance hint: an audio with a callback carries the chain onward.
    if (call.kind === "audio" && call.literal && call.chained && lvl < levelCount) {
      target.advance = { mode: "audio", file: call.literal };
    }
  }

  // after(ms, corrupt) as a level driver — only where no audio chain already
  // owns the transition.
  const audioDriven = new Set<number>();
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].advance.mode === "audio") audioDriven.add(i + 1);
  }
  const afterCorruptRe = /\bafter\(\s*(\d+)\s*,\s*corrupt\s*\)/g;
  let acm: RegExpExecArray | null;
  while ((acm = afterCorruptRe.exec(code))) {
    const seg = segOf(acm.index);
    const lvl = seg === 0 ? 1 : seg;
    if (lvl >= 1 && lvl < levelCount && !audioDriven.has(lvl)) {
      levels[lvl - 1].advance = { mode: "time", seconds: Math.max(1, Math.round(Number(acm[1]) / 1000)) };
    }
  }

  /* ---- notes ---- */
  if (corruptCount === 0 && tableLevels.size === 0) {
    notes.push(
      "No corrupt() calls or corruption tables found — all actions were placed on a single level."
    );
  }
  if (preFirstCorrupt > 0) {
    notes.push(
      `${preFirstCorrupt} action(s) ran before the first corrupt() and were attached to level 1.`
    );
  }
  if (redefined.size > 0) {
    notes.push(
      `The script redefines built-in APIs: ${[...redefined].join(", ")}. Wrapper logic such as skipping or gating cannot be converted.`
    );
  }
  const loops = (code.match(/\bwhile\b/g) ?? []).length + (code.match(/\bfor\b[^\n]*\bdo\b/g) ?? []).length;
  if (loops > 0) notes.push(`${loops} loop(s) dropped — bulk or conditional spawning is not designer-representable.`);
  if (droppedBulk > 0) notes.push(`${droppedBulk} multiple_popups() call(s) dropped — bulk spawning has no designer equivalent.`);
  if (droppedRandomWeb > 0) notes.push(`${droppedRandomWeb} web(nil) random-URL call(s) dropped — set explicit URLs in the designer.`);
  if (droppedHelpers > 0) notes.push(`${droppedHelpers} helper call(s) with computed arguments dropped — the value was not a literal.`);
  if (computedRolls > 0) notes.push(`${computedRolls} roll() with a computed chance — those guards were not converted.`);
  if (scanBudgetHit) {
    notes.push("The script's nesting exceeded the conversion scan budget — later actions were not converted.");
  }
  if (chainedLinks > 0) {
    notes.push(
      `${chainedLinks} chained action(s) kept their audio on_stop sequence — each plays when the previous one ends.`
    );
  }
  if (chainedCalls > chainedLinks) {
    notes.push(
      `${chainedCalls - chainedLinks} callback argument(s) could not be resolved to a chain — check those levels' Advance settings.`
    );
  }
  if (delayedActions > 0) {
    notes.push(
      `${delayedActions} action(s) kept their original after(ms) delay — they fire staggered within the level, not all at once.`
    );
  }
  const totalActions = levels.reduce((sum, l) => sum + l.actions.length, 0);
  notes.unshift(
    `Converted ${totalActions} action(s) across ${levels.length} level(s). Nothing was written to the pack yet.`
  );

  return { design: { version: 1, startDelaySeconds: 2, levels }, notes };
}
