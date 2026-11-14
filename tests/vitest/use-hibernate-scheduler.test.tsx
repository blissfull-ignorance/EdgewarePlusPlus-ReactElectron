import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHibernateScheduler } from "../../src/features/hibernate/useHibernateScheduler";
import { useAppStore } from "../../src/stores/appStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

function seedSettings(overrides: Record<string, unknown> = {}): void {
  useSettingsStore.setState({
    hibernateMode: 1,
    hibernateType: "Original",
    hibernateMin: 5000,
    hibernateMax: 5000,
    wakeupActivity: 2,
    hibernateLength: 1000,
    delay: 1000,
    ...overrides,
  });
}

describe("useHibernateScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ isRunning: true, hibernateActive: false, hibernateNextBurst: null });
    seedSettings();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("arms a burst after the random delay and mirrors it into the app store", () => {
    const { result } = renderHook(() =>
      useHibernateScheduler({ active: true, rand: () => 0.5 })
    );
    expect(useAppStore.getState().hibernateNextBurst).toBeCloseTo(Date.now() + 5000, -2);
    expect(result.current.isActive).toBe(false);
    expect(result.current.countdownSeconds).toBe(5);
  });

  it("does nothing while inactive or when the mode is off", () => {
    renderHook(() => useHibernateScheduler({ active: false, rand: () => 0 }));
    expect(useAppStore.getState().hibernateNextBurst).toBeNull();

    seedSettings({ hibernateMode: 0 });
    renderHook(() => useHibernateScheduler({ active: true, rand: () => 0 }));
    expect(useAppStore.getState().hibernateNextBurst).toBeNull();
  });

  it("fires the burst ticks, then re-arms the next sleep", () => {
    const onBurstTick = vi.fn();
    const { result } = renderHook(() =>
      useHibernateScheduler({ active: true, onBurstTick, rand: () => 0 })
    );

    // +1 ms: fake timers only run timers nested at the sleep boundary when the
    // advance goes strictly past it.
    act(() => vi.advanceTimersByTime(5001));
    // Original burst: randint(1, 2) with rand 0 → 1 tick, immediate.
    expect(onBurstTick).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(false);
    // Re-armed for the next cycle.
    expect(useAppStore.getState().hibernateNextBurst).not.toBeNull();
  });

  it("marks hibernate active during a timed burst and clears it at the end", () => {
    const onBurstTick = vi.fn();
    seedSettings({ hibernateType: "Spaced", hibernateLength: 4000, delay: 2000 });
    renderHook(() => useHibernateScheduler({ active: true, onBurstTick, rand: () => 0 }));

    act(() => vi.advanceTimersByTime(5001)); // sleep done, burst starts (ticks at 0,2000)
    expect(useAppStore.getState().hibernateActive).toBe(true);
    expect(onBurstTick).toHaveBeenCalledTimes(1); // only the t=0 tick so far

    act(() => vi.advanceTimersByTime(2000));
    expect(onBurstTick).toHaveBeenCalledTimes(2);
    // The window is still open: no re-arm yet even though ticks are done.
    expect(useAppStore.getState().hibernateActive).toBe(true);

    act(() => vi.advanceTimersByTime(2000)); // window closes at burst+4000
    expect(useAppStore.getState().hibernateActive).toBe(false);
    expect(useAppStore.getState().hibernateNextBurst).not.toBeNull();
  });

  it("pump-scare bursts call onPumpScare instead of rolling ticks", () => {
    const onBurstTick = vi.fn();
    const onPumpScare = vi.fn();
    seedSettings({ hibernateType: "Pump-Scare" });
    renderHook(() =>
      useHibernateScheduler({ active: true, onBurstTick, onPumpScare, rand: () => 0 })
    );

    act(() => vi.advanceTimersByTime(5000));
    expect(onPumpScare).toHaveBeenCalledTimes(1);
    expect(onBurstTick).not.toHaveBeenCalled();
  });

  it("stop() tears everything down and nothing fires afterwards", () => {
    const onBurstTick = vi.fn();
    const { result } = renderHook(() =>
      useHibernateScheduler({ active: true, onBurstTick, rand: () => 0 })
    );
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(60_000));
    expect(onBurstTick).not.toHaveBeenCalled();
    expect(useAppStore.getState().hibernateNextBurst).toBeNull();
    expect(useAppStore.getState().hibernateActive).toBe(false);
  });

  it("unmounting mid-sleep cancels the pending burst", () => {
    const onBurstTick = vi.fn();
    const { unmount } = renderHook(() =>
      useHibernateScheduler({ active: true, onBurstTick, rand: () => 0 })
    );
    unmount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(onBurstTick).not.toHaveBeenCalled();
  });

  it("the burst disposes the countdown interval it replaces", () => {
    // A sleep delay that is not a multiple of the 250ms countdown tick means
    // the interval is still alive when fireBurst runs: it must be disposed
    // there, or it leaks past the burst and kills the NEXT cycle's interval.
    seedSettings({ hibernateMin: 1100, hibernateMax: 1100 });
    renderHook(() => useHibernateScheduler({ active: true, rand: () => 0 }));
    expect(vi.getTimerCount()).toBe(2); // countdown interval + sleep timer

    act(() => vi.advanceTimersByTime(1101)); // burst fires and re-arms
    expect(vi.getTimerCount()).toBe(2); // no orphaned interval
  });

  it("tray skip fires the pending burst now and re-arms (legacy skip_hibernate)", () => {
    let skip: (() => void) | null = null;
    const w = window as unknown as { api?: unknown };
    const prevApi = w.api;
    w.api = {
      hibernate: {
        onSkip: (cb: () => void) => {
          skip = cb;
          return () => undefined;
        },
      },
    };
    try {
      const onBurstTick = vi.fn();
      renderHook(() => useHibernateScheduler({ active: true, onBurstTick, rand: () => 0 }));

      act(() => skip!());
      act(() => vi.advanceTimersByTime(1));
      // The burst fires immediately...
      expect(onBurstTick).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hibernateNextBurst).not.toBeNull();
      // ...and the cancelled sleep must never double-fire: past the original
      // 5000ms deadline only the skip-re-armed cycle (one burst) may exist.
      act(() => vi.advanceTimersByTime(6000));
      expect(onBurstTick).toHaveBeenCalledTimes(2); // exactly the re-armed burst
    } finally {
      w.api = prevApi;
    }
  });
});
