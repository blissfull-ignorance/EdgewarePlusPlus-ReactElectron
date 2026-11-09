/**
 * @file runtime — Pure level arithmetic for the corruption runtime driver.
 *
 * Mirrors the legacy `features/corruption.py` progression:
 * - Normal mode walks levels upward and stops at the highest; purity mode
 *   starts at the highest and eases back down to 1.
 * - The launch trigger replays the legacy loop over the persisted launch
 *   count: for each index i in 0..max-1, a count of at least `launches * i`
 *   advances one level (the i=0 hit is unconditional, matching legacy).
 * - Config overrides only apply with full permission; `themeType` additionally
 *   requires the theme-cycle grant. Blocked keys are already filtered at parse
 *   time by the engine.
 */

export function nextLevelFor(level: number, maxLevel: number, purity: boolean): number {
  if (purity) return level > 1 ? level - 1 : 1;
  return level < maxLevel ? level + 1 : maxLevel;
}

export function startLevelFor(maxLevel: number, purity: boolean): number {
  return purity ? maxLevel : 1;
}

export function computeLaunchLevel(launchCount: number, launches: number, maxLevel: number): number {
  let level = 1;
  for (let i = 0; i < maxLevel; i++) {
    if (launchCount >= launches * i) {
      level = nextLevelFor(level, maxLevel, false);
    }
  }
  return level;
}

export function gateOverrides(
  overrides: Record<string, string | number>,
  opts: { fullPerm: boolean; themeCycle: boolean }
): Record<string, string | number> {
  if (!opts.fullPerm) return {};
  const allowed: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "themeType" && !opts.themeCycle) continue;
    allowed[key] = value;
  }
  return allowed;
}
