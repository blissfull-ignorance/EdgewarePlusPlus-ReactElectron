import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { initLuaVM, getLuaVM, LuaExecResult } from "../scripting/fengariAdapter";
import { app } from "electron";
import { logger } from "../utils/logger";

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

function registerHandlers(): void {
  ipcMain.handle("scripting:runLua", async (_event, scriptName: string): Promise<boolean> => {
    const packDir = currentPackDir();
    if (!packDir) {
      logger.warn("[Scripting] No pack directory set");
      return false;
    }

    const scriptFilename = scriptName.endsWith(".lua") ? scriptName : `${scriptName}.lua`;
    const scriptPath = path.resolve(packDir, scriptFilename);
    const safeBase = packDir.endsWith(path.sep) ? packDir : `${packDir}${path.sep}`;
    if (!scriptPath.startsWith(safeBase)) {
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
    const result: LuaExecResult = vm.exec(scriptContent);

    if (!result.success) {
      logger.error(`[Scripting] Script execution error: ${result.error}`);
      return false;
    }

    logger.info(`[Scripting] Successfully executed: ${scriptName}`);
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
    logger.info(`[Scripting] Injected corruption level ${level}, callbacks fired: ${results.length}`);
    return true;
  });
}

export { registerHandlers };
