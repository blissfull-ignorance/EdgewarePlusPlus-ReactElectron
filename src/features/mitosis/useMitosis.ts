import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";

export type PopupSpawnType = "image" | "video";

export interface MitosisSpawn {
  type: PopupSpawnType;
}

/**
 * Weighted roll between image and video popup types.
 * Image has slightly higher weight (60/40 split) by default.
 * Deterministic given a seed.
 */
export function weightedPopupRoll(seed: number): PopupSpawnType {
  const hash = ((seed * 1103515245 + 12345) & 0x7fffffff) % 100;
  return hash < 60 ? "image" : "video";
}

/**
 * Compute the list of popups to spawn for one mitosis cycle.
 * Returns array of spawn entries based on strength.
 */
export function computeMitosisSpawn(strength: number, seed: number): MitosisSpawn[] {
  if (strength <= 0) return [];

  const maxSpawns = Math.min(strength, 10);
  const spawns: MitosisSpawn[] = [];

  for (let i = 0; i < maxSpawns; i++) {
    spawns.push({
      type: weightedPopupRoll(seed + i),
    });
  }

  return spawns;
}

export interface UseMitosisOptions {
  onSpawn?: (spawns: MitosisSpawn[]) => void;
}

/**
 * React hook that seeds the first mitosis popup when a mitosis session
 * starts (legacy handle_mitosis_mode) and re-spawns when the screen empties
 * (legacy popup_number observer). The roll loop zeroes image/video under
 * mitosis, so this seed is the session's only media-popup origin.
 */
export function useMitosis(options: UseMitosisOptions = {}) {
  const { onSpawn } = options;

  const isRunning = useAppStore((s) => s.isRunning);
  const popupsCount = useAppStore((s) => s.popupsCount);
  const mitosisMode = useSettingsStore((s) => s.mitosisMode);
  const mitosisStrength = useSettingsStore((s) => s.mitosisStrength);

  const prevCountRef = useRef(0);
  const seedRef = useRef(0);
  const spawningRef = useRef(false);
  const seededRef = useRef(false);

  const triggerMitosis = useCallback(() => {
    if (!mitosisMode || mitosisStrength <= 0 || spawningRef.current) return;

    spawningRef.current = true;
    seedRef.current += 1;

    const spawns = computeMitosisSpawn(mitosisStrength, seedRef.current);

    if (spawns.length > 0 && onSpawn) {
      onSpawn(spawns);
    }

    spawningRef.current = false;
  }, [mitosisMode, mitosisStrength, onSpawn]);

  useEffect(() => {
    if (!isRunning) {
      seededRef.current = false;
      return;
    }
    if (mitosisMode === 1 && mitosisStrength > 0 && !seededRef.current) {
      seededRef.current = true;
      seedRef.current += 1;
      onSpawn?.([{ type: weightedPopupRoll(seedRef.current) }]);
    }
  }, [isRunning, mitosisMode, mitosisStrength, onSpawn]);

  useEffect(() => {
    if (
      mitosisMode &&
      prevCountRef.current > 0 &&
      popupsCount === 0
    ) {
      triggerMitosis();
    }
    prevCountRef.current = popupsCount;
  }, [popupsCount, mitosisMode, triggerMitosis]);

  return {
    triggerMitosis,
    isMitosisActive: mitosisMode === 1,
    mitosisStrength,
  };
}
