import { useCallback, useMemo } from "react";
import { useCorruptionStore, getNextCorruptionLevel } from "../stores/corruptionStore";
import { useSettingsStore } from "../stores/settingsStore";

/**
 * React hook for corruption (guided mode) management.
 *
 * Subscribes to corruptionStore and settingsStore to provide:
 * - Current level, active moods, driver type, next level time
 * - transitionTo() action that applies mood changes and returns config overrides
 * - Computed nextLevel and activeCorruption flags
 */
export function useCorruptionMode() {
  const currentLevel = useCorruptionStore((s) => s.currentLevel);
  const activeMoods = useCorruptionStore((s) => s.activeMoods);
  const nextLevelTime = useCorruptionStore((s) => s.nextLevelTime);
  const driverType = useCorruptionStore((s) => s.driverType);
  const transitionTo = useCorruptionStore((s) => s.transitionTo);
  const setDriverType = useCorruptionStore((s) => s.setDriverType);
  const setNextLevelTime = useCorruptionStore((s) => s.setNextLevelTime);
  const loadCorruptionData = useCorruptionStore((s) => s.loadCorruptionData);
  const reset = useCorruptionStore((s) => s.reset);
  const corruptionMode = useSettingsStore((s) => s.corruptionMode);

  const activeCorruption = corruptionMode === 1;

  const nextLevel = useMemo(() => {
    return activeCorruption ? getNextCorruptionLevel() : null;
  }, [activeCorruption, currentLevel]);

  const transitionToLevel = useCallback(
    (level: number) => {
      const configOverrides = transitionTo(level);
      return configOverrides;
    },
    [transitionTo]
  );

  return {
    level: currentLevel,
    activeMoods,
    nextLevelTime,
    driverType,
    nextLevel,
    activeCorruption,
    transitionTo: transitionToLevel,
    setDriverType,
    setNextLevelTime,
    loadCorruptionData,
    reset,
  };
}
