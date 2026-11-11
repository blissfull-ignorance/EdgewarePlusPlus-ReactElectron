import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { initLuaVM, getLuaVM, LuaExecResult, EdgewareHost } from "../scripting/fengariAdapter";
import { resolveScriptPath } from "../scripting/scriptPath";
import { injectLevel } from "./corruption";
import { app } from "electron";
import { logger } from "../utils/logger";
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
      const vm = getLuaVM();
      const next = (vm?.getCurrentLevel() ?? 0) + 1;
      vm?.setCurrentLevel(next);
      injectLevel(next);
      logger.info(`[Scripting] corrupt() advanced to level ${next}`);
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
    video: (file) => spawnMedia("video", file, resolveRandomVideo),
    audio: (file) => {
      // Legacy routes Lua audio through the same player pool as the roll
      // driver: the max_audio cap applies to both sources together.
      const cap = readNumberSetting("maxAudio") || 5;
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
