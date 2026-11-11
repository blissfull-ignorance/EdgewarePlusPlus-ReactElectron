/**
 * TypeScript interfaces for all legacy pack data classes from `pack/data.py`.
 * Mirrors the exact structure and default values from the Python dataclasses.
 */

/**
 * MoodSet — a set-like collection where `null` checks always return true
 * (matching the "mood is in set or None" semantics of `MoodSet.__contains__`).
 */
export class MoodSet {
  private items: Set<string>;

  constructor(iterable?: Iterable<string>) {
    this.items = new Set(iterable);
  }

  add(value: string): this {
    this.items.add(value);
    return this;
  }

  clear(): void {
    this.items.clear();
  }

  delete(value: string): boolean {
    return this.items.delete(value);
  }

  has(value: unknown): boolean {
    return value === null || this.items.has(value as string);
  }

  get size(): number {
    return this.items.size;
  }

  get iterable(): Iterable<string> {
    return this.items;
  }

  [Symbol.iterator](): Iterator<string> {
    return this.items[Symbol.iterator]();
  }

  values(): Iterator<string> {
    return this.items.values();
  }

  keys(): Iterator<string> {
    return this.items.keys();
  }

  entries(): Iterator<[string, string]> {
    return this.items.entries();
  }

  forEach(
    callback: (value: string, value2: string, set: MoodSet) => void,
    thisArg?: unknown
  ): void {
    this.items.forEach((v) => callback.call(thisArg, v, v, this));
  }

  copy(): MoodSet {
    return new MoodSet(this.items);
  }
}

/** Base properties shared by both `Default` and `Mood` entries. */
export interface MoodBase {
  maxClicks: number;
  captions: string[];
  denial: string[];
  subliminals: string[];
  notifications: string[];
  prompts: string[];
  web: Web[];
}

/**
 * A web action definition from pack moods.
 */
export interface Web {
  url: string;
  args: string[];
}

export type Default = MoodBase & {
  popupClose: string;
  promptCommand: string;
  promptSubmit: string;
  promptMinLength: number;
  promptMaxLength: number;
};

export type Mood = MoodBase & {
  name: string | undefined;
};

/**
 * A single level of the corruption (guided mode) configuration.
 * Each level defines mood transitions, an optional wallpaper, and config overrides.
 */
export interface CorruptionLevel {
  addedMoods: MoodSet;
  removedMoods: MoodSet;
  wallpaper: string | null;
  config: Record<string, string | number>;
}

export interface DiscordOverride {
  text: string;
  image: string;
}

/**
 * Pack index.json — defines moods, media-to-mood mappings, and defaults.
 */
export interface Index {
  default: Default;
  moods: Mood[];
  /** file → every mood whose `media` list names it (untagged files are absent) */
  mediaMoods: Record<string, string[]>;
}

/**
 * Pack info.json — pack metadata.
 */
export interface Info {
  name: string;
  moodFile: string;
  creator: string;
  version: string;
  description: string;
}

/**
 * Gallery: one pack media file with its mood tags (empty = default content).
 */
export interface GalleryEntry {
  file: string;
  kind: "image" | "video" | "audio";
  moods: string[];
}

export interface GalleryResult {
  entries: GalleryEntry[];
  /** Every mood tag the pack defines, sorted. */
  moods: string[];
  /** Moods currently unlocked by the corruption progression. */
  activeMoods: string[];
}

/**
 * Pack listing entry — returned by system:listPacks IPC.
 */
export interface PackListing {
  name: string;
  path: string;
  version?: string;
  creator?: string;
}

/**
 * Default values for pack configuration matching the legacy `Default` dataclass.
 */
export const DEFAULT_INDEX: Index = {
  default: {
    maxClicks: 1,
    captions: [],
    denial: [],
    subliminals: [],
    notifications: [],
    prompts: [],
    web: [],
    popupClose: "I Submit <3",
    promptCommand: "Type for me, slut~",
    promptSubmit: "I Submit <3",
    promptMinLength: 1,
    promptMaxLength: 1,
  },
  moods: [],
  mediaMoods: {},
};

/**
 * Default pack info values.
 */
export const DEFAULT_INFO: Info = {
  name: "Unnamed Pack",
  moodFile: "",
  creator: "Anonymous",
  version: "1.0",
  description: "No description set.",
};
