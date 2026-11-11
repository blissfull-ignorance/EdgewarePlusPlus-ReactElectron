/**
 * @file moodState — The renderer's active corruption moods, mirrored into
 * the main process so pack content resolvers (media, text, web) can gate
 * selection the legacy way: default content always, mood content only while
 * its mood is active.
 */

let activeMoods = new Set<string>();

export function setActiveMoods(moods: string[]): void {
  activeMoods = new Set(moods);
}

export function getActiveMoods(): ReadonlySet<string> {
  return activeMoods;
}

/** Whether a pack file tagged with `moods` may be selected right now:
 *  untagged files are always eligible; tagged files need any one tag active. */
export function isMoodEligible(moods: string[] | undefined): boolean {
  if (!moods || moods.length === 0) return true;
  return moods.some((mood) => activeMoods.has(mood));
}
