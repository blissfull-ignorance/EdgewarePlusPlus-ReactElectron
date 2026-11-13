import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { clicksForIndex, useRandomClicksToClose } from "../../src/hooks/useRandomClicksToClose";

describe("clicksForIndex (legacy random_clicks_to_close parity)", () => {
  it("returns 1 when no pack index is available", () => {
    expect(clicksForIndex(null)).toBe(1);
  });

  it("rolls within [1, default.maxClicks] using the default mood", () => {
    const idx = { default: { maxClicks: 4 } };
    for (let i = 0; i < 200; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "foo.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it("uses the maxClicks of the file's mapped mood", () => {
    const idx = {
      default: { maxClicks: 2 },
      mediaMoods: { "foo.png": "strict" },
      moods: [{ name: "strict", maxClicks: 7 }],
    };
    for (let i = 0; i < 300; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "foo.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(7);
    }
    // A file without a mood mapping stays inside the default range.
    for (let i = 0; i < 200; i++) {
      const n = clicksForIndex(idx as unknown as Record<string, unknown>, "bar.png");
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("clamps pathological maxClicks values", () => {
    expect(clicksForIndex({ default: { maxClicks: 0 } })).toBe(1);
    const n = clicksForIndex({ default: { maxClicks: 100000 }});
    expect(n).toBeLessThanOrEqual(100);
  });
});

describe("useRandomClicksToClose hook paths", () => {
  it("returns 0 when multi-click is disabled", () => {
    const { result } = renderHook(() => useRandomClicksToClose(0));
    expect(result.current).toBe(0);
  });

  it("falls back to 1 click when no IPC bridge exists", async () => {
    const original = (window as unknown as Record<string, unknown>).api;
    (window as unknown as Record<string, unknown>).api = undefined;
    try {
      const { result } = renderHook(() => useRandomClicksToClose(1));
      await waitFor(() => expect(result.current).toBe(1));
    } finally {
      (window as unknown as Record<string, unknown>).api = original;
    }
  });

  it("falls back to 1 click when the index load rejects", async () => {
    const fn = window.api.pack.loadIndex;
    window.api.pack.loadIndex = vi.fn().mockRejectedValue(new Error("IPC down"));
    try {
      const { result } = renderHook(() => useRandomClicksToClose(1));
      await waitFor(() => expect(result.current).toBe(1));
    } finally {
      window.api.pack.loadIndex = fn;
    }
  });

  it("applies the pack's maxClicks through the bridge", async () => {
    const fn = window.api.pack.loadIndex;
    window.api.pack.loadIndex = vi.fn().mockResolvedValue({ default: { maxClicks: 4 } });
    try {
      const { result } = renderHook(() => useRandomClicksToClose(1));
      await waitFor(() => expect(result.current).toBeGreaterThanOrEqual(1));
      expect(result.current).toBeLessThanOrEqual(4);
      act(() => undefined);
    } finally {
      window.api.pack.loadIndex = fn;
    }
  });
});
