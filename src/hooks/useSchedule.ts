/**
 * @file useSchedule — in-app session scheduler.
 *
 * When scheduling is enabled and the runtime is not already running, the
 * scheduler waits `scheduleTime` (+ up to `varianceTime` random delay) and
 * then starts the runtime; with repeat enabled it re-arms after `repeatTime`
 * intervals. Unlike the legacy OS-task approach (Windows-only), the app must
 * be running — pair it with run-at-startup for unattended sessions.
 */
import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useAppStore } from "../stores/appStore";
import { firstFireAt, repeatIntervalMs } from "../features/schedule/schedule";
import { logger } from "../utils/logger";

export function useSchedule(running: boolean): void {
  useEffect(() => {
    if (running) return;
    const s0 = useSettingsStore.getState();
    if (s0.schedule !== 1) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      const s = useSettingsStore.getState();
      const fireAt = firstFireAt(Date.now(), s.scheduleTime, s.timeType, s.varianceTime, s.varianceType);
      const wait = Math.max(1000, fireAt - Date.now());
      logger.info(`[schedule] next scheduled session in ${Math.round(wait / 1000)}s`);
      timer = setTimeout(fire, wait);
    };

    const fire = () => {
      if (cancelled) return;
      const s = useSettingsStore.getState();
      if (!useAppStore.getState().isRunning) {
        useAppStore.getState().start();
        logger.info("[schedule] scheduled session started");
      }
      const interval = repeatIntervalMs(s.repeatSchedule, s.repeatTime, s.repeatType);
      if (interval) {
        timer = setTimeout(fire, interval);
      }
    };

    arm();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [running]);
}
