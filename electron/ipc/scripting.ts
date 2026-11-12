import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { initLuaVM, getLuaVM, LuaExecResult, EdgewareHost } from "../scripting/fengariAdapter";
import { resolveScriptPath } from "../scripting/scriptPath";
import {
  designFromScript,
  generateCorruptionJson,
  generateLua,
} from "../../src/features/creator/designerModel";
import { injectLevel, mirroredLevel } from "./corruption";
import { app } from "electron";
import { logger } from "../utils/logger";
import { invalidateGalleryScan, looksLikePack } from "./pack";
import {
  createPopupWindow,
  closeAllPopups,
  countPopupsByType,
  onPopupClosed,
} from "./popup";
import {
  resolveRandomImage,
  resolveRandomVideo,
  resolveRandomAudio,
  resolveRandomPrompt,
  resolveRandomWeb,
  resolveNotificationText,
  resolveSubliminalText,
  resolvePackName,
  setCloseLabelOverride,
  activePackPath,
} from "./pack";
import { showNotification, openExternalUrl } from "./system";
import { panicFromTray } from "./panic";

/** Write via temp file + rename so a crash never leaves a half-written file. */
function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, file);
}

const STARTER_SCRIPT = `-- Edgeware++ pack script (edgeware_v0)
-- Runs automatically when the runtime starts. Available calls:
--   roll(pct)                true with pct% chance
--   after(ms, fn)            call fn after ms
--   corrupt()                advance the corruption level (unlocks moods)
--   image([file]) video([f]) audio([file], [on_stop]) prompt([text], [on_close])
--   subliminal([text]) web([url]) notification([text]) close_popups()
--   set_popup_close_text(t)  panic()
-- Media files are picked at random from the pack unless named explicitly,
-- and mood-tagged files only appear while their mood is active.

require("edgeware_v0")

after(2000, function()
    notification("Your pack script is running")
    corrupt()
end)
`;

/**
 * Advance the corruption progression by one level, keeping the Lua VM's own
 * counter in step so a scripted chain and a manual skip agree.
 */
function advanceCorruptionLevel(): number {
  const vm = getLuaVM();
  // The higher of the VM's own counter and the published mirror: a manual
  // skip must step from where the session actually is, even when no Lua VM
  // (or a freshly reset one) is driving.
  const base = Math.max(vm?.getCurrentLevel() ?? 0, mirroredLevel());
  const next = base + 1;
  vm?.setCurrentLevel(next);
  injectLevel(next);
  logger.info(`[Scripting] corrupt() advanced to level ${next}`);
  return next;
}

function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

function currentPackDir(): string | null {
  try {
    const cfg = fs.readFileSync(path.join(dataDir(), "config.json"), "utf-8");
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    const raw = parsed.packPath as string | undefined;
    return raw ? raw : null;
  } catch {
    return null;
  }
}

function readNumberSetting(key: string): number {
  try {
    const cfg = fs.readFileSync(path.join(dataDir(), "config.json"), "utf-8");
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    return Number(parsed[key]) || 0;
  } catch {
    return 0;
  }
}

/** A stored cap of 0 means "none allowed"; only a missing key takes the fallback. */
function readCap(key: string, fallback: number): number {
  try {
    const cfg = fs.readFileSync(path.join(dataDir(), "config.json"), "utf-8");
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    const value = Number(parsed[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Runtime operations behind the edgeware_v0 Lua globals: popups, corruption,
 * panic, browser and notifications, all resolved against the active pack.
 */
function buildEdgewareHost(): EdgewareHost {
  const spawnMedia = (
    type: "image" | "video" | "audio",
    file: string | null,
    random: () => string | null
  ): string | null => {
    const name = file ?? random();
    if (!name) {
      logger.warn(`[Scripting] edgeware_v0 ${type}(): pack provides no media`);
      return null;
    }
    return createPopupWindow(type, name).id;
  };

  return {
    corrupt: () => {
      advanceCorruptionLevel();
    },
    panic: () => {
      panicFromTray();
    },
    closePopups: () => {
      closeAllPopups();
    },
    setPopupCloseText: (text) => {
      setCloseLabelOverride(text);
    },
    image: (file) => spawnMedia("image", file, resolveRandomImage),
    video: (file) => {
      const cap = readCap("maxVideos", 50);
      if (countPopupsByType("video") >= cap) {
        logger.warn(`[Scripting] edgeware_v0 video() refused: maxVideos (${cap}) reached`);
        return null;
      }
      return spawnMedia("video", file, resolveRandomVideo);
    },
    audio: (file) => {
      // Legacy routes Lua audio through the same player pool as the roll
      // driver: the max_audio cap applies to both sources together.
      const cap = readCap("maxAudio", 5);
      if (countPopupsByType("audio") >= cap) {
        logger.warn(`[Scripting] edgeware_v0 audio() refused: maxAudio (${cap}) reached`);
        return null;
      }
      return spawnMedia("audio", file, resolveRandomAudio);
    },
    prompt: (text) => {
      const phrase = text ?? resolveRandomPrompt();
      if (!phrase) {
        logger.warn("[Scripting] edgeware_v0 prompt(): pack provides no prompt text");
        return null;
      }
      return createPopupWindow("prompt", phrase).id;
    },
    subliminal: (text) => {
      const phrase = text ?? resolveSubliminalText();
      if (!phrase) {
        logger.warn("[Scripting] edgeware_v0 subliminal(): pack provides no text");
        return null;
      }
      return createPopupWindow("subliminal", phrase).id;
    },
    web: (url) => {
      const target = url ?? resolveRandomWeb();
      if (!target) {
        logger.warn("[Scripting] edgeware_v0 web(): pack provides no url");
        return;
      }
      void openExternalUrl(target);
    },
    notification: (text) => {
      const message = text ?? resolveNotificationText();
      if (!message) {
        logger.warn("[Scripting] edgeware_v0 notification(): pack provides no text");
        return;
      }
      const title = resolvePackName() ?? "Edgeware++";
      let attachment: string | undefined;
      if (readNumberSetting("notificationImageChance") > 0 && Math.random() * 100 < readNumberSetting("notificationImageChance")) {
        const img = resolveRandomImage();
        const packDir = activePackPath();
        if (img && packDir) attachment = path.join(packDir, "img", img);
      }
      showNotification(title, message, attachment);
    },
  };
}

/**
 * Tear down the Lua session: clears pending after() timers and popup
 * callbacks and closes the interpreter, so a stopped runtime cannot keep
 * driving popups or audio chains.
 */
function stopScripting(): void {
  const vm = getLuaVM();
  if (vm) {
    vm.destroy();
  }
}

function registerHandlers(): void {
  onPopupClosed((id) => {
    getLuaVM()?.handlePopupClosed(id);
  });

  ipcMain.handle("scripting:runLua", async (_event, scriptName: string): Promise<boolean> => {
    if (typeof scriptName !== "string" || !scriptName) {
      logger.warn("[Scripting] Invalid script name");
      return false;
    }
    const packDir = currentPackDir();
    if (!packDir) {
      logger.warn("[Scripting] No pack directory set");
      return false;
    }

    const scriptPath = resolveScriptPath(packDir, scriptName) ?? "";
    if (!scriptPath) {
      logger.warn(`[Scripting] Path traversal attempt blocked: ${scriptName}`);
      return false;
    }
    if (!fs.existsSync(scriptPath)) {
      logger.warn(`[Scripting] Script not found: ${scriptPath}`);
      return false;
    }

    let scriptContent: string;
    try {
      scriptContent = fs.readFileSync(scriptPath, "utf-8");
    } catch (err) {
      logger.error(`[Scripting] Failed to read script: ${err}`);
      return false;
    }

    const vm = initLuaVM();
    vm.setHost(buildEdgewareHost());
    const result: LuaExecResult = vm.exec(scriptContent);

    if (!result.success) {
      logger.error(`[Scripting] Script execution error: ${result.error}`);
      return false;
    }

    logger.info(`[Scripting] Successfully executed: ${scriptName}`);
    return true;
  });

  /**
   * Run the bundled edgeware_v0 API self-test: spawns visible popups and
   * corruption transitions so the scripting surface can be verified by hand
   * from Settings → Troubleshooting. Restarts the Lua session.
   */
  ipcMain.handle("scripting:runSelfTest", async (): Promise<{ ok: boolean; error?: string }> => {
    const candidates = [
      path.join(__dirname, "../dist/lua/edgeware-api-test.lua"),
      path.join(__dirname, "../../public/lua/edgeware-api-test.lua"),
    ];
    const scriptPath = candidates.find((c) => fs.existsSync(c));
    if (!scriptPath) {
      return { ok: false, error: "Bundled self-test script is missing from the app package." };
    }
    let scriptContent: string;
    try {
      scriptContent = fs.readFileSync(scriptPath, "utf-8");
    } catch (err) {
      logger.error(`[Scripting] Failed to read self-test script: ${err}`);
      return { ok: false, error: `Could not read the self-test script: ${String(err)}` };
    }

    const vm = initLuaVM();
    vm.setHost(buildEdgewareHost());
    const result: LuaExecResult = vm.exec(scriptContent);
    if (!result.success) {
      logger.error(`[Scripting] Self-test execution error: ${result.error}`);
      return { ok: false, error: result.error ?? "Lua execution error" };
    }
    logger.info("[Scripting] Self-test script started");
    return { ok: true };
  });

  ipcMain.handle("scripting:stop", async (): Promise<boolean> => {
    stopScripting();
    logger.info("[Scripting] Lua session stopped");
    return true;
  });

  /**
   * Creator tools: read the pack's script.lua (or an empty starter) so the
   * in-app designer can edit it. Paths stay inside the pack directory.
   */
  /**
   * Creator tools: turn the pack's hand-written script.lua into a designed
   * script. The original is archived (script.lua.bak, then .bak-2 … .bak-9,
   * then a timestamped name), its literal popup actions and the corruption
   * tables are converted into a design, and the generated script plus its
   * corruption.json replace the hand-written pair. Unrepresentable control
   * flow is reported, never guessed.
   */
  ipcMain.handle(
    "scripting:convertScript",
    async (
      _event,
      packPath: unknown
    ): Promise<{ backupName: string; notes: string[]; levelCount: number } | null> => {
      if (typeof packPath !== "string" || !packPath) return null;
      const dir = path.resolve(packPath.replace(/^~/, process.env.HOME ?? packPath));
      if (!looksLikePack(dir)) return null;
      const script = path.join(dir, "script.lua");
      const corruptionFile = path.join(dir, "corruption.json");
      try {
        let lua = "";
        if (fs.existsSync(script)) {
          lua = fs.readFileSync(script, "utf-8");
          if (lua.length > 200_000) {
            logger.warn("[Scripting] Pack script too large to convert in-app");
            return null;
          }
        }
        let corruption: unknown = {};
        if (fs.existsSync(corruptionFile)) {
          try {
            corruption = JSON.parse(fs.readFileSync(corruptionFile, "utf-8"));
          } catch {
            // A malformed hand-authored table file is preserved, not reshaped.
            logger.warn("[Scripting] Pack corruption.json is malformed; refusing to convert");
            return null;
          }
          if (!corruption || typeof corruption !== "object" || Array.isArray(corruption)) {
            return null;
          }
        }
        const { design, notes } = designFromScript(lua, corruption);
        let backupName = "";
        if (fs.existsSync(script)) {
          const candidates = [
            "script.lua.bak",
            ...Array.from({ length: 8 }, (_, i) => `script.lua.bak-${i + 2}`),
            `script.lua.bak-${Date.now()}`,
          ];
          const target = candidates.find((name) => !fs.existsSync(path.join(dir, name)));
          if (!target) return null;
          fs.copyFileSync(script, path.join(dir, target));
          backupName = target;
        }
        writeAtomic(script, generateLua(design));
        writeAtomic(corruptionFile, generateCorruptionJson(design));
        logger.info(
          `[Scripting] Hand-written script converted to design (${design.levels.length} level(s), backup ${backupName || "none"})`
        );
        return { backupName, notes, levelCount: design.levels.length };
      } catch (err) {
        logger.error("[Scripting] Failed to convert pack script:", err);
        return null;
      }
    }
  );

  /** Manual "skip": advance the corruption level by one (testing aid). */
  ipcMain.handle("scripting:advanceLevel", async (): Promise<number> => advanceCorruptionLevel());

  ipcMain.handle(
    "scripting:readScript",
    async (_event, packPath: unknown): Promise<{ content: string; exists: boolean; tooLarge?: boolean } | null> => {
      if (typeof packPath !== "string" || !packPath) return null;
      const dir = path.resolve(packPath.replace(/^~/, process.env.HOME ?? packPath));
      if (!looksLikePack(dir)) return null;
      const file = path.join(dir, "script.lua");
      if (path.dirname(file) !== dir) return null;
      const exists = fs.existsSync(file);
      if (!exists) return { content: STARTER_SCRIPT, exists: false };
      try {
        const content = fs.readFileSync(file, "utf-8");
        if (content.length > 200_000) {
          logger.warn("[Scripting] Pack script too large to edit in-app");
          return { content: "", exists: true, tooLarge: true };
        }
        return { content, exists: true };
      } catch (err) {
        logger.error("[Scripting] Failed to read pack script:", err);
        return null;
      }
    }
  );

  /**
   * Creator tools: save a designed script and its corruption tables as one
   * unit, so the sequence and the level effects can never drift apart.
   */
  ipcMain.handle(
    "scripting:writePackDesign",
    async (_event, packPath: unknown, lua: unknown, corruptionJson: unknown): Promise<boolean> => {
      if (
        typeof packPath !== "string" ||
        !packPath ||
        typeof lua !== "string" ||
        lua.length > 200_000 ||
        !(corruptionJson === null || typeof corruptionJson === "string") ||
        (typeof corruptionJson === "string" && corruptionJson.length > 200_000)
      ) {
        return false;
      }
      // null means "no level tables to write"; the pack's corruption.json
      // (possibly hand-authored) stays untouched.
      let parsed: unknown = null;
      if (typeof corruptionJson === "string") {
        try {
          parsed = JSON.parse(corruptionJson);
        } catch {
          return false;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      }
      const dir = path.resolve(packPath.replace(/^~/, process.env.HOME ?? packPath));
      if (!looksLikePack(dir)) return false;
      try {
        writeAtomic(path.join(dir, "script.lua"), lua);
        if (parsed) {
          writeAtomic(path.join(dir, "corruption.json"), JSON.stringify(parsed, null, 2));
        }
        invalidateGalleryScan();
        logger.info("[Scripting] Pack design saved");
        return true;
      } catch (err) {
        logger.error("[Scripting] Failed to save pack design:", err);
        return false;
      }
    }
  );

  ipcMain.handle(
    "scripting:writeScript",
    async (_event, packPath: unknown, content: unknown): Promise<boolean> => {
      if (typeof packPath !== "string" || !packPath || typeof content !== "string") return false;
      if (content.length > 200_000) return false;
      const dir = path.resolve(packPath.replace(/^~/, process.env.HOME ?? packPath));
      if (!looksLikePack(dir)) return false;
      const file = path.join(dir, "script.lua");
      try {
        writeAtomic(file, content);
        logger.info(`[Scripting] Pack script saved (${content.length} chars)`);
        return true;
      } catch (err) {
        logger.error("[Scripting] Failed to write pack script:", err);
        return false;
      }
    }
  );

  ipcMain.handle("scripting:injectCorruptionLevel", async (_event, level: number): Promise<boolean> => {
    const vm = getLuaVM();
    if (!vm) {
      logger.warn("[Scripting] Lua VM not initialized");
      return false;
    }

    vm.setCurrentLevel(level);
    const results = vm.triggerTransition(level);
    injectLevel(level);
    logger.info(`[Scripting] Injected corruption level ${level}, callbacks fired: ${results.length}`);
    return true;
  });
}

export { registerHandlers, stopScripting };
