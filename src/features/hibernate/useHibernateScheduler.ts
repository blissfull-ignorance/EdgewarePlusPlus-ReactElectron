/**
 * @file useHibernateScheduler — drives legacy hibernate mode while the
 * runtime runs. Hibernate replaces the normal roll loop: sleep a random
 * delay, fire a burst of roll-ticks, repeat. State is mirrored into the app
 * store so the status badge, the countdown and the wallpaper gate all read
 * the same truth.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { computeNextHibernateDelay, planBurst } from "./HibernateScheduler";

export interface HibernateState {
  isActive: boolean;
  nextBurstTime: number | null;
  countdownSeconds: number;
}

export interface UseHibernateSchedulerOptions {
  /** Only schedule while the runtime runs. */
  active: boolean;
  /** One burst tick: rolls the popup targets like a normal tick. */
  onBurstTick?: () => void;
  /** Pump-scare burst: one image + one audio popup. */
  onPumpScare?: () => void;
  /** Injectable for deterministic tests. */
  rand?: () => number;
}

export function useHibernateScheduler(options: UseHibernateSchedulerOptions) {
  const { active, onBurstTick, onPumpScare } = options;

  const hibernateMode = useSettingsStore((s) => s.hibernateMode);
  const setHibernateActive = useAppStore((s) => s.setHibernateActive);
  const setHibernateNextBurst = useAppStore((s) => s.setHibernateNextBurst);

  const [state, setState] = useState<HibernateState>({
    isActive: false,
    nextBurstTime: null,
    countdownSeconds: 0,
  });

  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tickRef = useRef(onBurstTick);
  const pumpRef = useRef(onPumpScare);
  // Held in a ref so an inline `rand` from the caller never re-triggers the
  // scheduling effect on every render.
  const randRef = useRef(options.rand ?? Math.random);
  randRef.current = options.rand ?? Math.random;
  tickRef.current = onBurstTick;
  pumpRef.current = onPumpScare;

  const clearTimers = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    for (const t of burstTimersRef.current) clearTimeout(t);
    sleepTimerRef.current = null;
    countdownRef.current = null;
    burstTimersRef.current = [];
  }, []);

  // arm ↔ fireBurst are mutually recursive; refs break the declaration cycle.
  const fireBurstRef = useRef<() => void>(() => undefined);
  const armRef = useRef<() => void>(() => undefined);

  const arm = useCallback(() => {
    const s = useSettingsStore.getState();
    const delay = computeNextHibernateDelay(s.hibernateMin, s.hibernateMax, randRef.current);
    const nextTime = Date.now() + delay;

    setHibernateNextBurst(nextTime);
    setState({ isActive: false, nextBurstTime: nextTime, countdownSeconds: Math.ceil(delay / 1000) });

    countdownRef.current = setInterval(() => {
      const remaining = nextTime - Date.now();
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else {
        setState((prev) => ({ ...prev, countdownSeconds: Math.ceil(remaining / 1000) }));
      }
    }, 250);

    sleepTimerRef.current = setTimeout(() => fireBurstRef.current(), delay);
  }, [setHibernateNextBurst]);
  armRef.current = arm;

  const fireBurst = useCallback(() => {
    countdownRef.current = null;
    const s = useSettingsStore.getState();
    const plan = planBurst({
      type: s.hibernateType as Parameters<typeof planBurst>[0]["type"],
      wakeupActivity: s.wakeupActivity,
      hibernateLengthMs: s.hibernateLength,
      popupDelayMs: Number(s.delay),
      rand: randRef.current,
    });

    setHibernateActive(true);
    setHibernateNextBurst(null);
    setState({ isActive: true, nextBurstTime: null, countdownSeconds: 0 });

    const finish = () => {
      setHibernateActive(false);
      if (useSettingsStore.getState().hibernateMode === 1 && useAppStore.getState().isRunning) {
        armRef.current();
      }
    };

    if (plan.isPumpScare) {
      pumpRef.current?.();
      finish();
      return;
    }

    let at = 0;
    burstTimersRef.current = [];
    for (const interval of plan.intervalsMs) {
      at += interval;
      const t = setTimeout(() => tickRef.current?.(), at);
      burstTimersRef.current.push(t);
    }
    const endT = setTimeout(finish, at);
    burstTimersRef.current.push(endT);
  }, [setHibernateActive, setHibernateNextBurst]);
  fireBurstRef.current = fireBurst;

  const stop = useCallback(() => {
    clearTimers();
    setHibernateActive(false);
    setHibernateNextBurst(null);
    setState({ isActive: false, nextBurstTime: null, countdownSeconds: 0 });
  }, [clearTimers, setHibernateActive, setHibernateNextBurst]);

  useEffect(() => {
    if (active && hibernateMode === 1) {
      arm();
    } else {
      stop();
    }
    return clearTimers;
  }, [active, hibernateMode, arm, stop, clearTimers]);

  // Tray "Skip Hibernate": stand down until the next Start (legacy parity —
  // skipping does not re-arm the cycle).
  useEffect(() => {
    return window.api?.hibernate?.onSkip?.(() => stop());
  }, [stop]);

  return { ...state, stop };
}
