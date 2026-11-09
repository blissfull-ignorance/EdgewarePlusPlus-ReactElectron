import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveScriptPath } from "../../electron/scripting/scriptPath";

/**
 * Path traversal protection for scripting:runLua — a script name must always
 * resolve inside the active pack directory.
 */
describe("resolveScriptPath", () => {
  const packDir = path.resolve("/test/user/data/data/packs/testpack");

  it("rejects script names with path traversal sequences", () => {
    expect(resolveScriptPath(packDir, "../../../etc/evil")).toBeNull();
    expect(resolveScriptPath(packDir, "../outside.lua")).toBeNull();
  });

  it("allows legitimate script names within pack directory", () => {
    expect(resolveScriptPath(packDir, "script.lua")).toBe(path.join(packDir, "script.lua"));
  });

  it("allows subdirectory script names within pack directory", () => {
    expect(resolveScriptPath(packDir, "sub/script.lua")).toBe(
      path.join(packDir, "sub", "script.lua")
    );
  });

  it("rejects sibling directory with shared prefix", () => {
    expect(resolveScriptPath(packDir, "../testpack-evil/x.lua")).toBeNull();
  });

  it("appends .lua extension when not provided", () => {
    expect(resolveScriptPath(packDir, "voice7")).toBe(path.join(packDir, "voice7.lua"));
  });
});
