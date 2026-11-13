import { useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useAppStore } from "../stores/appStore";
import { roll } from "../utils/roll";

// "subliminal" remains in the union so persisted settings and mood data still
// parse; it is never rolled — "caption" is the text popup spawn instead.
export type PopupType = "image" | "video" | "audio" | "prompt" | "caption" | "subliminal" | "web" | "notification";

export interface RollTarget {
  type: PopupType;
  chance: number;
}

/**
 * The popup "types" that can fire as standalone spawns. "caption" is the
 * legacy subliminal text popup (capPop* settings, no media). "subliminal"
 * (hypno) is NOT here — it's an overlay rendered on top of image/video pops,
 * driven independently by `subliminalsChance` in the dispatch layer, so
 * spirals actually sit over other media instead of competing for a spawn slot.
 */
function buildRollTargets(settings: ReturnType<typeof useSettingsStore.getState>): RollTarget[] {
  return [
    { type: "image", chance: settings.popupMod },
    { type: "video", chance: settings.vidMod },
    { type: "audio", chance: settings.audioMod },
    { type: "prompt", chance: settings.promptMod },
    { type: "caption", chance: settings.capPopChance },
    { type: "web", chance: settings.webMod },
    { type: "notification", chance: settings.notificationChance },
  ];
}

/**
 * Every popup type whose chance passes on a roll, evaluated independently. This is
 * the core of the fix: types no longer shadow each other (a type at 100% always
 * appears regardless of image). Pure + takes a `rollFn` so it is deterministic to test.
 *
 * Legacy parity: with single_mode on, exactly ONE type is chosen per tick via a
 * weighted choice over the chances (legacy roll_targets), instead of independent rolls.
 */
export function duePopups(
  settings: ReturnType<typeof useSettingsStore.getState>,
  rollFn: (chance: number) => boolean = roll,
  randomFn: () => number = Math.random
): PopupType[] {
  if (settings.singleMode) {
    const eligible = buildRollTargets(settings).filter((t) => t.chance > 0);
    if (!eligible.length) return [];
    const total = eligible.reduce((sum, t) => sum + t.chance, 0);
    let pick = randomFn() * total;
    for (const t of eligible) {
      pick -= t.chance;
      if (pick < 0) return [t.type];
    }
    return [eligible[eligible.length - 1].type];
  }
  return buildRollTargets(settings).filter((t) => rollFn(t.chance)).map((t) => t.type);
}

interface UseRollOptions {
  /**
   * Called once for every popup type that passes its per-tick probability. A type
   * at 100% ALWAYS fires here regardless of the other types, so video/audio/prompt
   * are never shadowed just because images are also on.
   */
  onSpawn?: (type: PopupType) => void;
}

export function useRoll(options: UseRollOptions = {}) {
  const { onSpawn } = options;
  const isRunning = useAppStore((s) => s.isRunning);
  // A hand-edited or pack-preset delay can be non-numeric; NaN would make
  // setInterval fire at its ~4ms clamp — a popup flood. Fall back to the
  // default cadence instead.
  const delay = useSettingsStore((s) => {
    const raw = Number(s.delay);
    return Math.max(100, Number.isFinite(raw) ? raw : 5000);
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const settings = useSettingsStore.getState();
    if (!onSpawn) return;
    // Independent per-type coin flips each tick: a type at 100% always fires this
    // tick regardless of the others, so video/audio/prompt aren't shadowed by image.
    for (const type of duePopups(settings)) {
      onSpawn(type);
    }
  }, [onSpawn]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isRunning) return;

    intervalRef.current = setInterval(tick, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, delay, tick]);
}
