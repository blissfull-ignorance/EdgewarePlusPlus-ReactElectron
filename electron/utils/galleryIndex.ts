/**
 * @file galleryIndex — Pure builder for the gallery's file→mood tag map.
 *
 * Pack content is tagged two ways: the modern index.json lists media files
 * per mood (`moods[].media`), and legacy packs ship a media.json keyed by
 * mood name. A file may carry any number of mood tags; untagged files are
 * default content.
 */

export function buildFileMoods(
  modernMoods: Array<{ mood?: unknown; media?: unknown }> | undefined,
  legacyMedia: Record<string, unknown> | undefined
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const add = (file: string, mood: string): void => {
    const list = (map[file] ??= []);
    if (!list.includes(mood)) list.push(mood);
  };

  for (const mood of modernMoods ?? []) {
    if (typeof mood?.mood !== "string" || !mood.mood || !Array.isArray(mood.media)) continue;
    for (const file of mood.media) {
      if (typeof file === "string" && file) add(file, mood.mood);
    }
  }

  for (const [moodName, files] of Object.entries(legacyMedia ?? {})) {
    if (moodName === "default" || !Array.isArray(files)) continue;
    for (const file of files) {
      if (typeof file === "string" && file) add(file, moodName);
    }
  }

  return map;
}
