import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isPathConstrained } from "../../electron/utils/mediaGuard";

describe("isPathConstrained (symlink confinement)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ewpp-guard-"));
  const sub = path.join(root, "img");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, "real.png"), "png");
  fs.writeFileSync(path.join(root, "secret.txt"), "top secret");
  const link = path.join(sub, "link.png");
  try {
    fs.symlinkSync(path.join(root, "secret.txt"), link);
  } catch {
    /* symlinks may be unavailable on this volume */
  }

  const realpath = (p: string): string => fs.realpathSync(p);

  it("accepts a plain file inside the subdir", () => {
    expect(isPathConstrained(realpath, root, "img", path.join(sub, "real.png"))).toBe(true);
  });

  it("rejects a symlink escaping the subdir", () => {
    if (!fs.existsSync(link)) return;
    expect(isPathConstrained(realpath, root, "img", link)).toBe(false);
  });

  it("rejects lexical traversal before any filesystem access", () => {
    expect(isPathConstrained(realpath, root, "img", path.join(root, "secret.txt"))).toBe(false);
  });

  it("rejects missing files", () => {
    expect(isPathConstrained(realpath, root, "img", path.join(sub, "nope.png"))).toBe(false);
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
});
