/**
 * @file TaggingSection — in-app mood tagging: assign the pack's media files
 * to moods, writing straight into the pack folder's index.json.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconPlus, IconTrash, IconPencil, IconStarFilled } from "@tabler/icons-react";
import type { GalleryEntry, GalleryResult } from "../../types/pack";
import { resolvePackMediaUrl } from "../popup/resolveMediaUrl";
import { KIND_DIR, favouriteKey } from "../gallery/favouriteKey";
import { ConfirmFileDelete } from "../../components/ConfirmFileDelete";
import { useSettingsStore } from "../../stores/settingsStore";

/** Cards render in pages so a 1000+ file pack opens instantly. */
const GRID_PAGE = 150;

interface RawMood {
  mood: string;
  media?: unknown;
  [key: string]: unknown;
}

function parseIndex(index: Record<string, unknown> | null): RawMood[] {
  const moods = index?.moods;
  if (!Array.isArray(moods)) return [];
  return moods.filter((m): m is RawMood => !!m && typeof m === "object" && typeof (m as RawMood).mood === "string");
}

function tagsFor(moods: RawMood[], file: string): string[] {
  return moods
    .filter((m) => Array.isArray(m.media) && (m.media as unknown[]).includes(file))
    .map((m) => m.mood);
}

function Thumb({ entry }: { entry: GalleryEntry }) {
  const url = resolvePackMediaUrl(entry.file, KIND_DIR[entry.kind]);
  if (entry.kind === "image") {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: 110, objectFit: "cover", display: "block", borderRadius: 6 }}
      />
    );
  }
  if (entry.kind === "video") {
    return (
      <video
        src={url}
        muted
        preload="metadata"
        style={{ width: "100%", height: 110, objectFit: "cover", display: "block", borderRadius: 6 }}
      />
    );
  }
  return (
    <div
      style={{
        height: 110,
        borderRadius: 6,
        backgroundColor: "var(--mantine-color-dark-7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ♪
    </div>
  );
}

function TagEditor({
  entry,
  moods,
  onToggle,
}: {
  entry: GalleryEntry;
  moods: RawMood[];
  onToggle: (file: string, mood: string, on: boolean) => void;
}) {
  const current = new Set(tagsFor(moods, entry.file));
  const url = resolvePackMediaUrl(entry.file, KIND_DIR[entry.kind]);
  return (
    <Modal
      opened
      onClose={() => onToggle(entry.file, "", false)}
      title={entry.file}
      size="lg"
      centered
      closeButtonProps={{ "aria-label": "Close tag editor" }}
    >
      <Stack gap="sm" data-testid={`tag-editor-${entry.file}`}>
        <div
          data-testid={`tag-preview-${entry.file}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            maxHeight: "45vh",
            overflow: "hidden",
            borderRadius: 8,
            backgroundColor: "var(--mantine-color-dark-8)",
          }}
        >
          {entry.kind === "image" ? (
            <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: "45vh", objectFit: "contain" }} />
          ) : entry.kind === "video" ? (
            <video
              src={url}
              controls
              autoPlay
              muted
              playsInline
              style={{ width: "100%", maxHeight: "45vh" }}
              data-testid={`tag-preview-video-${entry.file}`}
            />
          ) : (
            <audio src={url} controls autoPlay data-testid={`tag-preview-audio-${entry.file}`} style={{ width: "100%" }} />
          )}
        </div>
        <Text size="xs" c="dimmed">
          Which moods does this file belong to? Mood-tagged content only appears
          in popups while its mood is active.
        </Text>
        {moods.length === 0 ? (
          <Text size="sm" c="dimmed">
            This pack has no moods yet — add one in the Mood list first.
          </Text>
        ) : (
          <Group gap="xs" wrap="wrap">
            {moods.map((m) => (
              <Chip
                key={m.mood}
                checked={current.has(m.mood)}
                onChange={() => onToggle(entry.file, m.mood, !current.has(m.mood))}
                size="xs"
                data-testid={`tag-chip-${entry.file}-${m.mood}`}
              >
                {m.mood}
              </Chip>
            ))}
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

export function TaggingSection() {
  const packPath = useSettingsStore((s) => s.packPath);
  const [gallery, setGallery] = useState<GalleryResult>({ entries: [], moods: [], activeMoods: [], favourites: [], rootImages: [] });
  const [moods, setMoods] = useState<RawMood[]>([]);
  const [newMood, setNewMood] = useState("");
  const [editing, setEditing] = useState<GalleryEntry | null>(null);
  const [deleting, setDeleting] = useState<GalleryEntry | null>(null);
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savedAt, setSavedAt] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video" | "audio">("all");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [shown, setShown] = useState(GRID_PAGE);

  const reload = useCallback(async () => {
    if (!packPath) return;
    const [g, idx] = await Promise.all([
      window.api?.pack.listGallery(packPath),
      window.api?.pack.getEditableIndex(packPath),
    ]);
    if (g) setGallery(g);
    setMoods(parseIndex(idx ?? null));
  }, [packPath]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const applyIndex = (index: Record<string, unknown> | null): void => {
    if (!index) return;
    setMoods(parseIndex(index));
    setSavedAt(Date.now());
    void reload().catch(() => undefined);
  };

  const toggleTag = (file: string, mood: string, on: boolean): void => {
    if (!packPath) return;
    if (!mood) {
      setEditing(null);
      return;
    }
    const next = tagsFor(moods, file);
    const updated = on ? [...next, mood] : next.filter((t) => t !== mood);
    void window.api?.pack
      .setFileTags(packPath, file, updated)
      .then(applyIndex)
      .catch(() => undefined);
  };

  const addMoodNamed = (): void => {
    if (!packPath || !newMood.trim()) return;
    void window.api?.pack
      .addMood(packPath, newMood.trim())
      .then((idx) => {
        setNewMood("");
        applyIndex(idx);
      })
      .catch(() => undefined);
  };

  const removeMoodNamed = (name: string): void => {
    if (!packPath) return;
    void window.api?.pack
      .removeMood(packPath, name)
      .then(applyIndex)
      .catch(() => undefined);
  };

  const moodOf = useMemo(() => new Map(moods.map((m) => [m.mood, m])), [moods]);

  // One pass over the mood tables; per-card lookups stay O(1) even for a
  // thousand-file pack re-rendering on every filter change.
  const tagsByFile = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of moods) {
      if (!Array.isArray(m.media)) continue;
      for (const file of m.media) {
        if (typeof file !== "string") continue;
        const list = map.get(file);
        if (list) list.push(m.mood);
        else map.set(file, [m.mood]);
      }
    }
    return map;
  }, [moods]);
  const tagsOf = useCallback((file: string): string[] => tagsByFile.get(file) ?? [], [tagsByFile]);

  // Hypno spirals are overlay-only media with their own gallery class;
  // they are never mood-tagged, so they never appear in this grid.
  const taggable = useMemo(
    () => gallery.entries.filter((e) => e.kind !== "hypno"),
    [gallery.entries]
  );
  const favouriteKeys = useMemo(() => new Set(gallery.favourites), [gallery.favourites]);

  const uncategorizedCount = useMemo(
    () => taggable.filter((e) => tagsOf(e.file).length === 0).length,
    [taggable, tagsOf]
  );
  const visibleEntries = useMemo(
    () =>
      taggable.filter((e) => {
        if (onlyUncategorized && tagsOf(e.file).length > 0) return false;
        if (typeFilter !== "all" && e.kind !== typeFilter) return false;
        if (favouritesOnly && !favouriteKeys.has(favouriteKey(e))) return false;
        return true;
      }),
    [taggable, tagsOf, onlyUncategorized, typeFilter, favouritesOnly, favouriteKeys]
  );

  useEffect(() => {
    setShown(GRID_PAGE);
  }, [packPath, onlyUncategorized, typeFilter, favouritesOnly]);

  const commitRename = (): void => {
    if (!packPath || !renaming || !renameValue.trim() || renameValue.trim() === renaming) {
      setRenaming(null);
      return;
    }
    void window.api?.pack
      .renameMood(packPath, renaming, renameValue.trim())
      .then((idx) => {
        setRenaming(null);
        applyIndex(idx);
      })
      .catch(() => undefined);
  };

  if (!packPath) {
    return <Text c="dimmed" data-testid="tagging-no-pack">Select a pack first on the Status tab or in Pack Management.</Text>;
  }

  return (
    <Stack gap="md" data-testid="creator-tagging">
      <Group gap="sm" wrap="wrap">
        <TextInput
          size="xs"
          placeholder="New mood name"
          value={newMood}
          onChange={(e) => setNewMood(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && addMoodNamed()}
          data-testid="creator-new-mood"
          aria-label="New mood name"
        />
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addMoodNamed} data-testid="creator-add-mood">
          Add mood
        </Button>
        {savedAt > 0 ? (
          <Text size="xs" c="teal" data-testid="creator-saved">
            Saved to pack.
          </Text>
        ) : null}
      </Group>

      <Group gap="xs" wrap="wrap">
        <Chip
          checked={onlyUncategorized}
          onChange={() => setOnlyUncategorized((v) => !v)}
          size="xs"
          data-testid="creator-uncategorized-chip"
        >
          <span data-testid="creator-uncategorized-label">
            Uncategorised ({uncategorizedCount} of {taggable.length})
          </span>
        </Chip>
        <Chip
          checked={favouritesOnly}
          onClick={() => setFavouritesOnly((v) => !v)}
          size="xs"
          data-testid="creator-favourites-chip"
        >
          <span data-testid="creator-favourites-label">
            <Group gap={4} wrap="nowrap">
              <IconStarFilled size={12} />
              Favourites ({taggable.filter((e) => favouriteKeys.has(favouriteKey(e))).length})
            </Group>
          </span>
        </Chip>
        <SegmentedControl
          data={[
            { label: "All", value: "all" },
            { label: "Images", value: "image" },
            { label: "Videos", value: "video" },
            { label: "Audio", value: "audio" },
          ]}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as typeof typeFilter)}
          size="xs"
          data-testid="creator-type-filter"
        />
      </Group>

      <Group gap="xs" wrap="wrap">
        {moods.map((m) => (
          <Group key={m.mood} gap={4} wrap="nowrap" data-testid={`creator-mood-${m.mood}`}>
            {renaming === m.mood ? (
              <TextInput
                size="xs"
                w={120}
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && commitRename()}
                onBlur={commitRename}
                data-testid={`creator-mood-rename-input-${m.mood}`}
                aria-label={`New name for mood ${m.mood}`}
              />
            ) : (
              <Chip checked disabled size="xs">
                {m.mood}
              </Chip>
            )}
            <Button
              size="xs"
              variant="subtle"
              aria-label={`Rename mood ${m.mood}`}
              data-testid={`creator-mood-rename-${m.mood}`}
              onClick={() => {
                setRenaming(m.mood);
                setRenameValue(m.mood);
              }}
            >
              <IconPencil size={12} />
            </Button>
            <Badge size="xs" variant="light" c="gray">
              {Array.isArray(m.media) ? m.media.length : 0}
            </Badge>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              aria-label={`Remove mood ${m.mood}`}
              data-testid={`creator-mood-remove-${m.mood}`}
              onClick={() => removeMoodNamed(m.mood)}
            >
              <IconTrash size={12} />
            </Button>
          </Group>
        ))}
      </Group>

      {gallery.entries.length === 0 ? (
        <Text c="dimmed">The active pack ships no media files to tag.</Text>
      ) : (
        <ScrollArea h="calc(100vh - 420px)" type="auto">
          <SimpleGrid cols={{ base: 3, sm: 4, md: 5, lg: 6 }} spacing="md" verticalSpacing="md">
            {visibleEntries.slice(0, shown).map((entry) => {
              const fileTags = tagsOf(entry.file);
              return (
                <Stack
                  key={`${entry.kind}:${entry.file}`}
                  gap={4}
                  data-testid={`creator-card-${entry.file}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setEditing(entry)}
                >
                  <div style={{ position: "relative" }}>
                    <Thumb entry={entry} />
                    <UnstyledButton
                      aria-label={`Delete ${entry.file}`}
                      data-testid={`creator-delete-${entry.file}`}
                      style={{ position: "absolute", top: 4, left: 4, padding: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.45)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(entry);
                      }}
                    >
                      <IconTrash size={15} color="rgba(255,255,255,0.85)" />
                    </UnstyledButton>
                  </div>
                  <Text size="xs" truncate title={entry.file}>
                    {entry.file}
                  </Text>
                  <Group gap={4} wrap="wrap">
                    {fileTags.length === 0 ? (
                      <Badge size="xs" variant="light" color="dark">
                        default
                      </Badge>
                    ) : (
                      fileTags.map((t) => (
                        <Badge key={t} size="xs" variant="light" color={moodOf.has(t) ? "violet" : "gray"}>
                          {t}
                        </Badge>
                      ))
                    )}
                  </Group>
                </Stack>
              );
            })}
          </SimpleGrid>
          {visibleEntries.length > shown ? (
            <Group justify="center" mt="md">
              <Button
                size="xs"
                variant="light"
                onClick={() => setShown((n) => n + GRID_PAGE)}
                data-testid="creator-load-more"
              >
                Load {Math.min(GRID_PAGE, visibleEntries.length - shown)} more (
                {visibleEntries.length - shown} hidden)
              </Button>
            </Group>
          ) : null}
        </ScrollArea>
      )}

      {editing ? <TagEditor entry={editing} moods={moods} onToggle={toggleTag} /> : null}
      <ConfirmFileDelete
        file={deleting?.file ?? null}
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const entry = deleting;
          setDeleting(null);
          if (!entry || !packPath) return;
          void window.api?.pack
            .deleteFile(packPath, entry.kind, entry.file)
            .then((res) => (res.ok ? reload() : undefined))
            .catch(() => undefined);
        }}
      />
    </Stack>
  );
}
