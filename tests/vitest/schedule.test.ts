import { describe, expect, it } from "vitest";
import { unitToMs, firstFireAt, repeatIntervalMs } from "../../src/features/schedule/schedule";

describe("unitToMs", () => {
  it("converts the three legacy time units", () => {
    expect(unitToMs(5, "Minutes")).toBe(300_000);
    expect(unitToMs(2, "Hours")).toBe(7_200_000);
    expect(unitToMs(1, "Days")).toBe(86_400_000);
  });

  it("falls back to minutes for unknown units and clamps negatives", () => {
    expect(unitToMs(1, "Weeks")).toBe(60_000);
    expect(unitToMs(-3, "Hours")).toBe(0);
  });
});

describe("firstFireAt", () => {
  it("adds base delay plus jitter within the variance window", () => {
    expect(firstFireAt(1000, 1, "Minutes", 1, "Minutes", () => 0)).toBe(1000 + 60_000);
    expect(firstFireAt(0, 1, "Minutes", 1, "Minutes", () => 1)).toBe(120_000);
  });

  it("floors the wait at one second", () => {
    expect(firstFireAt(0, 0, "Minutes", 0, "Minutes", () => 0.5)).toBe(1000);
  });
});

describe("repeatIntervalMs", () => {
  it("is null when repeating is off", () => {
    expect(repeatIntervalMs(0, 1, "Hours")).toBeNull();
  });

  it("converts the repeat unit when on", () => {
    expect(repeatIntervalMs(1, 2, "Hours")).toBe(7_200_000);
  });

  it("treats a zero repeat time as no repeat", () => {
    expect(repeatIntervalMs(1, 0, "Days")).toBeNull();
  });
});
