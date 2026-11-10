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
  moods?: (TextLists & { name?: string })[];
}

function usable(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((s) => typeof s === "string" && s.trim()) : [];
}

function pick(pool: string[], rand: () => number): string | null {
  return pool.length ? pool[Math.floor(rand() * pool.length)] ?? pool[pool.length - 1] : null;
}

/**
 * Mood lists limited to the active moods. When `activeMoods` is omitted every
 * mood counts (legacy packs without mood gating, and unit tests); when given,
 * only moods whose name is in the set contribute — mirroring the legacy
 * default-plus-active-mood pools.
 */
function enabledMoods(
  idx: TextIndex | undefined,
  activeMoods?: ReadonlySet<string>
): (TextLists & { name?: string })[] {
  const moods = Array.isArray(idx?.moods) ? idx.moods : [];
  if (!activeMoods) return moods;
  return moods.filter((m) => m.name && activeMoods.has(m.name));
}

export function pickSubliminalText(
  idx: TextIndex | undefined,
  rand: () => number = Math.random,
  activeMoods?: ReadonlySet<string>
): string | null {
  if (!idx) return null;
  const moods = enabledMoods(idx, activeMoods);

  const subliminals = [...usable(idx.default?.subliminals), ...moods.flatMap((m) => usable(m.subliminals))];
  const fromSubliminals = pick(subliminals, rand);
  if (fromSubliminals) return fromSubliminals;

  const captions = [...usable(idx.default?.captions), ...moods.flatMap((m) => usable(m.captions))];
  return pick(captions, rand);
}

/**
 * A random notification text: the `notifications` lists (default + active
 * moods), falling back to captions — mirrors legacy pack.random_notification().
 */
export function pickNotificationText(
  idx: TextIndex | undefined,
  rand: () => number = Math.random,
  activeMoods?: ReadonlySet<string>
): string | null {
  if (!idx) return null;
  const moods = enabledMoods(idx, activeMoods);

  const notifications = [
    ...usable((idx.default as { notifications?: string[] } | undefined)?.notifications),
    ...moods.flatMap((m) => usable((m as { notifications?: string[] } | undefined)?.notifications)),
  ];
  const fromNotifications = pick(notifications, rand);
  if (fromNotifications) return fromNotifications;

  const captions = [...usable(idx.default?.captions), ...moods.flatMap((m) => usable(m.captions))];
  return pick(captions, rand);
}
