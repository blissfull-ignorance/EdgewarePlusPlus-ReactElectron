/**
 * @file spawnWarning — why a Start would show (almost) no popups.
 *
 * Outside corruption mode the user's own settings alone decide whether the
 * roll loop spawns anything. These checks name the settings that silently
 * prevent a session (all chances at zero, a huge spawn delay, an instant
 * auto-close) so the Start button can surface them instead of appearing
 * broken. A pack script drives its own popups outside the roll loop, so a
 * scriptless pack is part of the "nothing can spawn" verdict; the delay is
 * only worth flagging when some chance can actually fire.
 */
import type { useSettingsStore } from "../../stores/settingsStore";

type Settings = ReturnType<typeof useSettingsStore.getState>;

/** Above this the session rolls for popups less than once every 10s. */
export const SLOW_SPAWN_DELAY_MS = 10000;
/** Below this auto-closed popups vanish faster than a blink. */
export const INSTANT_CLOSE_MS = 500;

export function collectSpawnBlockers(s: Settings, packHasScript: boolean): string[] {
  const issues: string[] = [];

  const chances: Array<[string, number]> = [
    ["Image popup chance", s.popupMod],
    ["Video popup chance", s.vidMod],
    ["Audio popup chance", s.audioMod],
    ["Prompt popup chance", s.promptMod],
    ["Caption popup chance", s.capPopChance],
    ["Web popup chance", s.webMod],
    ["Notification chance", s.notificationChance],
  ];
  const anyChanceLive = chances.some(([, chance]) => chance > 0);

  if (!anyChanceLive && !packHasScript) {
    issues.push(
      `Every popup chance is 0% (${chances.map(([label]) => label).join(", ")}). Nothing will ever spawn.`
    );
  }

  const delay = Number(s.delay);
  if (anyChanceLive && Number.isFinite(delay) && delay > SLOW_SPAWN_DELAY_MS) {
    const seconds = Math.round(delay / 100) / 10;
    issues.push(
      `Spawn Delay is ${seconds}s between popup rolls — at 100% image chance that is only one popup every ${seconds}s. Pack sessions can leave this value behind; lower it under Annoyance → Popup Tweaks.`
    );
  }

  if (s.timeoutPopups === 1 && Number(s.popupTimeout) > 0 && Number(s.popupTimeout) < INSTANT_CLOSE_MS) {
    issues.push(
      `Popups auto-close after ${s.popupTimeout}ms — they vanish before they can be seen.`
    );
  }

  return issues;
}
