import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("electron", () => ({
  app: {
    getPath: () =>
      (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA ?? "/mock",
  },
}));

import {
  getConfig,
  getSettingNumber,
  invalidateConfigCache,
  loadConfigOrNull,
  refreshConfig,
} from "../../electron/utils/configCache";

describe("configCache", () => {
  let tempRoot: string;
  let configPath: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "ewpp-config-cache-"));
    (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA = tempRoot;
    mkdirSync(path.join(tempRoot, "data"), { recursive: true });
    configPath = path.join(tempRoot, "data", "config.json");
    invalidateConfigCache();
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    delete (globalThis as { __EWPP_TEST_USER_DATA?: string }).__EWPP_TEST_USER_DATA;
    invalidateConfigCache();
  });

  it("primes from disk when nothing has been pushed", () => {
    writeFileSync(configPath, JSON.stringify({ lkCorner: 3 }));
    expect(loadConfigOrNull()).toEqual({ lkCorner: 3 });
    expect(getSettingNumber("lkCorner")).toBe(3);
  });

  it("a push replaces the disk view for every reader", () => {
    writeFileSync(configPath, JSON.stringify({ lkCorner: 3 }));
    expect(getSettingNumber("lkCorner")).toBe(3);
    refreshConfig({ lkCorner: 0 });
    expect(getSettingNumber("lkCorner")).toBe(0);
  });

  it("non-object pushes are refused, keeping the last good view", () => {
    refreshConfig({ lkCorner: 2 });
    refreshConfig("garbage");
    refreshConfig([1, 2]);
    refreshConfig(null);
    expect(getConfig()).toEqual({ lkCorner: 2 });
  });

  it("missing or corrupt disk state reads as empty until a push lands", () => {
    expect(loadConfigOrNull()).toBeNull();
    expect(getConfig()).toEqual({});
    writeFileSync(configPath, "{oops");
    invalidateConfigCache();
    expect(loadConfigOrNull()).toBeNull();
    refreshConfig({ movingSpeed: 5 });
    expect(getSettingNumber("movingSpeed")).toBe(5);
  });

  it("junk setting values read as 0", () => {
    refreshConfig({ movingSpeed: "abc", lkToggle: undefined, popupMod: 7 });
    expect(getSettingNumber("movingSpeed")).toBe(0);
    expect(getSettingNumber("lkToggle")).toBe(0);
    expect(getSettingNumber("missing")).toBe(0);
    expect(getSettingNumber("popupMod")).toBe(7);
  });

  it("invalidate re-primes from a rewritten disk file", () => {
    writeFileSync(configPath, JSON.stringify({ lkCorner: 1 }));
    expect(getSettingNumber("lkCorner")).toBe(1);
    writeFileSync(configPath, JSON.stringify({ lkCorner: 4 }));
    expect(getSettingNumber("lkCorner")).toBe(1); // cached
    invalidateConfigCache();
    expect(getSettingNumber("lkCorner")).toBe(4);
  });
});
