import path from "node:path";

/**
 * Resolve a pack script name against the pack directory and verify it stays
 * inside the pack (path traversal guard for scripting:runLua).
 */
export function resolveScriptPath(packDir: string, scriptName: string): string | null {
  const scriptFilename = scriptName.endsWith(".lua") ? scriptName : `${scriptName}.lua`;
  const scriptPath = path.resolve(packDir, scriptFilename);
  const safeBase = packDir.endsWith(path.sep) ? packDir : `${packDir}${path.sep}`;
  return scriptPath.startsWith(safeBase) ? scriptPath : null;
}
