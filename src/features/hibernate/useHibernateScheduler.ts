import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { computeBurstSchedule, computeNextHibernateDelay, BurstType } from "./HibernateScheduler";

export interface HibernateState {
  isActive: boolean;
  nextBurstTime: number | null;
  countdownSeconds: number;
  burstType: BurstType;
}

export interface UseHibernateSchedulerOptions {
  onBurstStart?: () => void;
  onBurstEnd?: () => void;
  onSpawnPopup?: (index: number) => void;
  onStop?: () => void;
}

export function useHibernateScheduler(options: UseHibernateSchedulerOptions = {}) {
  const { onBurstStart, onBurstEnd, onSpawnPopup, onStop } = options;

  const hibernateMode = useSettingsStore((s) => s.hibernateMode);
  const hibernateType = useSettingsStore((s) => s.hibernateType) as BurstType;
  const hibernateMin = useSettingsStore((s) => s.hibernateMin);
  const hibernateMax = useSettingsStore((s) => s.hibernateMax);
  const wakeupActivity = useSettingsStore((s) => s.wakeupActivity);
  const hibernateLength = useSettingsStore((s) => s.hibernateLength);

  const setHibernateActive = useAppStore((s) => s.setHibernateActive);

  const [state, setState] = useState<HibernateState>({
    isActive: false,
    nextBurstTime: null,
    countdownSeconds: 0,
    burstType: hibernateType,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seedRef = useRef(0);
  const burstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    for (const timer of burstTimersRef.current) {
      clearTimeout(timer);
    }
    burstTimersRef.current = [];
  }, []);

  const scheduleBurst = useCallback(() => {
    if (!hibernateMode) {
      clearTimers();
      setState({ isActive: false, nextBurstTime: null, countdownSeconds: 0, burstType: hibernateType });
      setHibernateActive(false);
      return;
    }

    seedRef.current += 1;
    const delay = computeNextHibernateDelay(hibernateMin, hibernateMax, seedRef.current);
    const nextTime = Date.now() + delay;

    setHibernateActive(true);
    setState((prev) => ({
      ...prev,
      isActive: true,
      nextBurstTime: nextTime,
      countdownSeconds: Math.ceil(delay / 1000),
      burstType: hibernateType,
    }));

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      const remaining = nextTime - Date.now();
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
      } else {
        setState((prev) => ({
          ...prev,
          nextBurstTime: nextTime,
          countdownSeconds: Math.ceil(remaining / 1000),
        }));
      }
    }, 250);

    timerRef.current = setTimeout(() => {
      executeBurst();
    }, delay);
  }, [hibernateMode, hibernateMin, hibernateMax, hibernateType, setHibernateActive, clearTimers]);

  const executeBurst = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    const numPopups = Math.max(1, Math.round(wakeupActivity));
    const burstDuration = Math.max(1000, hibernateLength || numPopups * 1000);

    seedRef.current += 1;
    const schedule = computeBurstSchedule({
      type: hibernateType,
      numPopups,
      burstDuration,
      seed: seedRef.current,
    });

    onBurstStart?.();

    burstTimersRef.current = [];
    let cumulativeDelay = 0;
    for (let i = 0; i < schedule.intervals.length; i++) {
      const delay = cumulativeDelay;
      cumulativeDelay += schedule.intervals[i];

      const t = setTimeout(() => {
        onSpawnPopup?.(i);
      }, delay);
      burstTimersRef.current.push(t);
    }

    const endT = setTimeout(() => {
      burstTimersRef.current = [];
      onBurstEnd?.();
      scheduleBurst();
    }, cumulativeDelay + (schedule.isPumpScare ? 200 : 0));
    burstTimersRef.current.push(endT);
  }, [hibernateType, wakeupActivity, hibernateLength, onBurstStart, onBurstEnd, onSpawnPopup, scheduleBurst]);

  const stop = useCallback(() => {
    clearTimers();
    setHibernateActive(false);
    setState({ isActive: false, nextBurstTime: null, countdownSeconds: 0, burstType: hibernateType });
    onStop?.();
  }, [clearTimers, setHibernateActive, onStop, hibernateType]);

  useEffect(() => {
    if (hibernateMode) {
      scheduleBurst();
    } else {
      stop();
    }
    return () => {
      clearTimers();
    };
  }, [hibernateMode, scheduleBurst, stop, clearTimers]);

  return {
    ...state,
    stop,
    scheduleBurst,
  };
}
