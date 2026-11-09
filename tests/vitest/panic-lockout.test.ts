import { describe, expect, it } from "vitest";
import { isLockoutActive, safewordMatches } from "../../electron/utils/panicLockout";

describe("isLockoutActive", () => {
  it("is inactive when lockout is not enabled", () => {
    expect(isLockoutActive({ enabled: false, until: 5000, now: 1000 })).toBe(false);
  });

  it("is active before the lockout deadline", () => {
    expect(isLockoutActive({ enabled: true, until: 5000, now: 4999 })).toBe(true);
  });

  it("is inactive at and after the deadline", () => {
    expect(isLockoutActive({ enabled: true, until: 5000, now: 5000 })).toBe(false);
    expect(isLockoutActive({ enabled: true, until: 5000, now: 9000 })).toBe(false);
  });

  it("is inactive without a deadline", () => {
    expect(isLockoutActive({ enabled: true, until: 0, now: 1000 })).toBe(false);
  });
});

describe("safewordMatches", () => {
  it("accepts the exact safeword", () => {
    expect(safewordMatches("hunter2", "hunter2")).toBe(true);
  });

  it("is case-sensitive like the legacy prompt", () => {
    expect(safewordMatches("Hunter2", "hunter2")).toBe(false);
  });

  it("rejects empty input against a set safeword", () => {
    expect(safewordMatches("", "hunter2")).toBe(false);
  });

  it("treats a missing safeword config as no lockout password (nothing matches)", () => {
    expect(safewordMatches("", "")).toBe(false);
    expect(safewordMatches("anything", "")).toBe(false);
  });
});
