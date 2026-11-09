/**
 * @file textPool — Pure picker for pack text lists (subliminal text popups).
 *
 * Mirrors the legacy `Pack.random_subliminal`: the pool is the `subliminals`
 * lists of the pack default plus every mood; when that pool is empty it falls
 * back to the `captions` lists the same way. Returns null when neither has a
 * usable (non-blank) entry, so the caller can skip the spawn.
 */

interface TextLists {
  subliminals?: string[];
  captions?: string[];
}

interface TextIndex {
  default?: TextLists;
  moods?: TextLists[];
}

function usable(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((s) => typeof s === "string" && s.trim()) : [];
}

function pick(pool: string[], rand: () => number): string | null {
  return pool.length ? pool[Math.floor(rand() * pool.length)] ?? pool[pool.length - 1] : null;
}

export function pickSubliminalText(
  idx: TextIndex | undefined,
  rand: () => number = Math.random
): string | null {
  if (!idx) return null;
  const moods = Array.isArray(idx.moods) ? idx.moods : [];

  const subliminals = [...usable(idx.default?.subliminals), ...moods.flatMap((m) => usable(m.subliminals))];
  const fromSubliminals = pick(subliminals, rand);
  if (fromSubliminals) return fromSubliminals;

  const captions = [...usable(idx.default?.captions), ...moods.flatMap((m) => usable(m.captions))];
  return pick(captions, rand);
}
