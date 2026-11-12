/**
 * @file CreatorPanel — in-app pack authoring: assign media files to moods
 * and design the corruption script, writing straight into the pack folder.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPalette, IconCode, IconPlus, IconTrash, IconPencil } from "@tabler/icons-react";
import { DesignerSection } from "./DesignerSection";
import type { GalleryEntry, GalleryResult } from "../../types/pack";
import { resolvePackMediaUrl, type MediaDir } from "../popup/resolveMediaUrl";
import { useSettingsStore } from "../../stores/settingsStore";

const KIND_DIR: Record<GalleryEntry["kind"], MediaDir> = {
  image: "img",
  video: "vid",
  audio: "aud",
};

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
  return (
    <Modal
      opened
      onClose={() => onToggle(entry.file, "", false)}
      title={entry.file}
      size="sm"
      centered
      closeButtonProps={{ "aria-label": "Close tag editor" }}
    >
      <Stack gap="sm" data-testid={`tag-editor-${entry.file}`}>
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

function TaggingSection({ onPackChanged }: { onPackChanged?: () => void }) {
  const packPath = useSettingsStore((s) => s.packPath);
  const [gallery, setGallery] = useState<GalleryResult>({ entries: [], moods: [], activeMoods: [], favourites: [] });
  const [moods, setMoods] = useState<RawMood[]>([]);
  const [newMood, setNewMood] = useState("");
  const [editing, setEditing] = useState<GalleryEntry | null>(null);
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savedAt, setSavedAt] = useState<number>(0);

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
    onPackChanged?.();
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

  const uncategorizedCount = useMemo(
    () => gallery.entries.filter((e) => tagsFor(moods, e.file).length === 0).length,
    [gallery.entries, moods]
  );
  const visibleEntries = useMemo(
    () =>
      onlyUncategorized
        ? gallery.entries.filter((e) => tagsFor(moods, e.file).length === 0)
        : gallery.entries,
    [gallery.entries, moods, onlyUncategorized]
  );

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
    return <Text c="dimmed">Select a pack first (Status tab or Pack Management).</Text>;
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
            Uncategorised ({uncategorizedCount} of {gallery.entries.length})
          </span>
        </Chip>
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
            {visibleEntries.map((entry) => {
              const fileTags = tagsFor(moods, entry.file);
              return (
                <Stack
                  key={`${entry.kind}:${entry.file}`}
                  gap={4}
                  data-testid={`creator-card-${entry.file}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setEditing(entry)}
                >
                  <Thumb entry={entry} />
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
        </ScrollArea>
      )}

      {editing ? <TagEditor entry={editing} moods={moods} onToggle={toggleTag} /> : null}
    </Stack>
  );
}

export function CreatorPanel() {
  const [section, setSection] = useState<"tagging" | "script">("tagging");
  // Bumped whenever tagging rewrites the pack, so the designer reloads the
  // mood list it validates its level cards against.
  const [packRevision, setPackRevision] = useState(0);

  return (
    <Stack gap="md" data-testid="creator-panel">
      <Group justify="space-between" align="center" wrap="wrap">
        <div>
          <Text fw={700} size="lg">
            Creator Tools
          </Text>
          <Text size="sm" c="dimmed">
            Categorize this pack's gallery into moods and design its corruption script.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            variant={section === "tagging" ? "filled" : "light"}
            leftSection={<IconPalette size={14} />}
            onClick={() => setSection("tagging")}
            data-testid="creator-tab-tagging"
          >
            Mood tagging
          </Button>
          <Button
            size="xs"
            variant={section === "script" ? "filled" : "light"}
            leftSection={<IconCode size={14} />}
            onClick={() => setSection("script")}
            data-testid="creator-tab-script"
          >
            Script designer
          </Button>
        </Group>
      </Group>
      <div style={{ display: section === "tagging" ? "block" : "none" }}>
        <TaggingSection onPackChanged={() => setPackRevision((r) => r + 1)} />
      </div>
      <div style={{ display: section === "script" ? "block" : "none" }}>
        <DesignerSection packRevision={packRevision} />
      </div>
    </Stack>
  );
}
