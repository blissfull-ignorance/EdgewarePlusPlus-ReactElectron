/**
 * @file packEdit — Pure mutations for a pack's index.json mood structure,
 * used by the in-app creator tools. Everything operates on the parsed JSON
 * object (not the runtime Index) so the pack's own key order and any
 * unrecognized fields survive an edit round-trip.
 */

export interface RawIndexLike {
  default?: Record<string, unknown>;
  moods?: unknown[];
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function moodNameOf(entry: unknown): string | null {
  const rec = asRecord(entry);
  const name = rec?.mood;
  return typeof name === "string" && name ? name : null;
}

/** Add a mood (no-op when the name already exists). Returns the new list. */
export function addMood(index: RawIndexLike, name: string): RawIndexLike {
  const clean = name.trim();
  if (!clean) return index;
  const moods = Array.isArray(index.moods) ? index.moods : [];
  if (moods.some((m) => moodNameOf(m) === clean)) return index;
  return { ...index, moods: [...moods, { mood: clean, captions: [], web: [], webArgs: [], media: [] }] };
}

/** Remove a mood and drop its name from every other mood's media list. */
export function removeMood(index: RawIndexLike, name: string): RawIndexLike {
  const moods = Array.isArray(index.moods) ? index.moods : [];
  const kept = moods.filter((m) => moodNameOf(m) !== name);
  const cleaned = kept.map((m) => {
    const rec = asRecord(m);
    if (!rec || !Array.isArray(rec.media)) return m;
    return { ...rec, media: rec.media.filter((f) => f !== name) };
  });
  return { ...index, moods: cleaned };
}

/**
 * Set the exact mood tags of a media file: the file joins `tags` and is
 * removed from every other mood's media list. An empty tag list untags it.
 */
export function setFileTags(index: RawIndexLike, file: string, tags: string[]): RawIndexLike {
  const wanted = new Set(tags.map((t) => t.trim()).filter(Boolean));
  const moods = (Array.isArray(index.moods) ? index.moods : []).map((entry) => {
    const rec = asRecord(entry);
    const name = moodNameOf(entry);
    if (!rec || !name) return entry;
    const media = Array.isArray(rec.media) ? rec.media.filter((f): f is string => typeof f === "string") : [];
    const without = media.filter((f) => f !== file);
    const next = wanted.has(name) ? [...without, file] : without;
    return { ...rec, media: next };
  });
  return { ...index, moods };
}

/** Every mood name the index defines, in file order. */
export function listMoodNames(index: RawIndexLike): string[] {
  return (Array.isArray(index.moods) ? index.moods : [])
    .map(moodNameOf)
    .filter((n): n is string => !!n);
}
