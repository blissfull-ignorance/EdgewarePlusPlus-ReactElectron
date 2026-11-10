/**
 * @file useCorruptionRuntime — drives corruption levels while the runtime runs.
 *
 * On activation with corruption mode on: loads the pack's corruption.json
 * into the corruption store, applies the starting level, and follows the
 * configured trigger — Timed (interval), Popup (spawn counter), Launch
 * (persisted launch count replay) or Script (injections relayed from the
 * main process). Each transition applies mood changes, full-permission
 * config overrides (theme changes additionally gated), the level wallpaper
 * when allowed, and publishes the level to the main process for the Lua API.
 */
import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useCorruptionStore } from "../stores/corruptionStore";
import { useAppStore } from "../stores/appStore";
import {
  nextLevelFor,
  startLevelFor,
  computeLaunchLevel,
  gateOverrides,
} from "../features/corruption/runtime";
import { logger } from "../utils/logger";

export function useCorruptionRuntime(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const timers: Array<ReturnType<typeof setInterval>> = [];
    const unsubscribes: Array<() => void> = [];

    const applyLevel = (level: number) => {
      const store = useCorruptionStore.getState();
      const levelData = store.levels[level];
      const overrides = store.transitionTo(level);

      const s = useSettingsStore.getState();
      // Legacy negation: corruptionWallpaperCycle/corruptionThemeCycle are
      // stored inverted — a stored 0 means the cycle is enabled.
      const allowed = gateOverrides(overrides, {
        fullPerm: s.corruptionFullPerm === 1,
        themeCycle: s.corruptionThemeCycle === 0,
      });
      if (Object.keys(allowed).length > 0) s.setRaw(allowed);

      if (levelData?.wallpaper && s.corruptionWallpaperCycle === 0 && s.packPath) {
        const root = String(s.packPath).replace(/\/+$/, "");
        void window.api?.system
          .setWallpaper(`${root}/${levelData.wallpaper}`)
          .catch((err) => logger.error("[corruption] wallpaper change failed:", err));
      }

      const nextTime =
        s.corruptionTrigger === "Timed" && level < maxKnownLevel(store.levels)
          ? Date.now() + Math.max(1000, s.corruptionTime)
          : null;
      void window.api?.corruption
        .setLevel(level, nextTime)
        .catch((err) => logger.error("[corruption] level publish failed:", err));
    };

    void (async () => {
      let raw: Record<string, unknown> | null = null;
      try {
        raw = (await window.api?.pack.loadCorruption()) ?? null;
      } catch (err) {
        logger.error("[corruption] failed to load pack corruption data:", err);
        return;
      }
      if (cancelled) return;
      if (!raw) {
        if (useSettingsStore.getState().corruptionMode === 1) {
          logger.warn("[corruption] corruption mode is on but the pack ships no corruption.json — staying off");
        }
        return;
      }

      useCorruptionStore.getState().reset();
      useCorruptionStore.getState().loadCorruptionData(raw);
      const { levels } = useCorruptionStore.getState();
      const maxLevel = maxKnownLevel(levels);
      if (maxLevel === 0) {
        logger.warn("[corruption] pack corruption data has no usable levels — staying off");
        return;
      }

      // Scripted/manual path (legacy run_script): level injections apply
      // while the runtime runs even with corruption mode off, because the
      // pack script itself drives the session.
      const unsubscribe = window.api?.corruption.onInject((level) => {
        applyLevel(Math.min(Math.max(1, level), maxLevel));
      });
      if (unsubscribe) unsubscribes.push(unsubscribe);

      const s = useSettingsStore.getState();
      // A script may have injected its first level before this listener
      // attached; pull the mirrored level so the transition is not lost.
      const pullMirrored = s.corruptionMode !== 1 || s.corruptionTrigger === "Script";
      if (pullMirrored) {
        try {
          const mirrored = (await window.api?.corruption.getCurrentLevel()) ?? 0;
          if (cancelled) return;
          if (mirrored >= 1 && useCorruptionStore.getState().currentLevel === 0) {
            applyLevel(Math.min(mirrored, maxLevel));
          }
        } catch {
          /* level mirror unavailable — injections still stream in */
        }
      }
      if (s.corruptionMode !== 1) return;
      const purity = s.corruptionPurityMode === 1;

      switch (s.corruptionTrigger) {
        case "Timed": {
          applyLevel(startLevelFor(maxLevel, purity));
          timers.push(
            setInterval(() => {
              const cur = useCorruptionStore.getState().currentLevel;
              applyLevel(nextLevelFor(cur, maxLevel, purity));
            }, Math.max(1000, s.corruptionTime))
          );
          break;
        }
        case "Popup": {
          applyLevel(startLevelFor(maxLevel, purity));
          let seen = useAppStore.getState().popupsCount;
          let spawned = 0;
          const threshold = Math.max(1, s.corruptionPopups);
          unsubscribes.push(
            useAppStore.subscribe((state) => {
              if (state.popupsCount > seen) spawned += state.popupsCount - seen;
              seen = state.popupsCount;
              if (spawned >= threshold) {
                spawned = 0;
                applyLevel(
                  nextLevelFor(useCorruptionStore.getState().currentLevel, maxLevel, purity)
                );
              }
            })
          );
          break;
        }
        case "Launch": {
          let count = 0;
          try {
            count = (await window.api?.system.corruptionLaunches()) ?? 0;
          } catch (err) {
            logger.error("[corruption] launch count unavailable:", err);
          }
          if (cancelled) return;
          applyLevel(computeLaunchLevel(count, Math.max(1, s.corruptionLaunches), maxLevel));
          break;
        }
        case "Script": {
          if (useCorruptionStore.getState().currentLevel === 0) {
            applyLevel(startLevelFor(maxLevel, purity));
          }
          break;
        }
        default:
          logger.warn(`[corruption] unknown trigger "${s.corruptionTrigger}" — staying off`);
      }
    })();

    return () => {
      cancelled = true;
      for (const t of timers) clearInterval(t);
      for (const u of unsubscribes) u();
    };
  }, [active]);
}

function maxKnownLevel(levels: Record<number, unknown>): number {
  return Object.keys(levels)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0);
}
