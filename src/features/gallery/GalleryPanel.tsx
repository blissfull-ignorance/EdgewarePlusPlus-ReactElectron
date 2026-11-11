/**
 * @file GalleryPanel — browse every pack media file by mood and type.
 *
 * Shows all content the active pack ships (including mood-locked files, so
 * creators and players can see what exists), with mood chips and a type
 * filter, and a lightbox for full-size viewing / playback.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Center,
  Chip,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconPhoto, IconVideo, IconMusic, IconLock, IconStar, IconStarFilled } from "@tabler/icons-react";
import type { GalleryEntry, GalleryResult } from "../../types/pack";
import { resolvePackMediaUrl, type MediaDir } from "../popup/resolveMediaUrl";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCorruptionStore } from "../../stores/corruptionStore";
import { useAppStore } from "../../stores/appStore";

const KIND_DIR: Record<GalleryEntry["kind"], MediaDir> = {
  image: "img",
  video: "vid",
  audio: "aud",
};

const KIND_ICON: Record<GalleryEntry["kind"], React.ReactNode> = {
  image: <IconPhoto size={40} stroke={1.2} />,
  video: <IconVideo size={40} stroke={1.2} />,
  audio: <IconMusic size={40} stroke={1.2} />,
};

/** Stable cross-pack identity for a media file: "<dir>/<file>". */
export function favouriteKey(entry: GalleryEntry): string {
  return `${KIND_DIR[entry.kind]}/${entry.file}`;
}

function Thumb({ entry }: { entry: GalleryEntry }) {
  const url = resolvePackMediaUrl(entry.file, KIND_DIR[entry.kind]);
  if (entry.kind === "image") {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: 130, objectFit: "cover", display: "block", borderRadius: 6 }}
      />
    );
  }
  if (entry.kind === "video") {
    return (
      <video
        src={url}
        muted
        preload="metadata"
        style={{ width: "100%", height: 130, objectFit: "cover", display: "block", borderRadius: 6 }}
      />
    );
  }
  return (
    <Center h={130} style={{ borderRadius: 6, backgroundColor: "var(--mantine-color-dark-7)" }}>
      {KIND_ICON.audio}
    </Center>
  );
}

export function GalleryPanel() {
  const packPath = useSettingsStore((s) => s.packPath);
  const [data, setData] = useState<GalleryResult>({ entries: [], moods: [], activeMoods: [], favourites: [] });
  const [loading, setLoading] = useState(true);
  const isRunning = useAppStore((s) => s.isRunning);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | GalleryEntry["kind"]>("all");
  const [selected, setSelected] = useState<GalleryEntry | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void window.api?.pack
      .listGallery(packPath)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [packPath, isRunning]);

  const sessionMoods = useCorruptionStore((s) => s.activeMoods);
  const active = useMemo(
    () => new Set([...data.activeMoods, ...sessionMoods]),
    [data.activeMoods, sessionMoods]
  );

  const favouriteKeys = useMemo(() => new Set(data.favourites), [data.favourites]);

  const visible = useMemo(
    () =>
      data.entries.filter((e) => {
        if (favouritesOnly && !favouriteKeys.has(favouriteKey(e))) return false;
        if (typeFilter !== "all" && e.kind !== typeFilter) return false;
        if (moodFilter === null) return true;
        if (moodFilter === "default") return e.moods.length === 0;
        return e.moods.includes(moodFilter);
      }),
    [data.entries, moodFilter, typeFilter, favouritesOnly, favouriteKeys]
  );

  const toggleFavourite = (entry: GalleryEntry): void => {
    const key = favouriteKey(entry);
    const next = !favouriteKeys.has(key);
    setData((d) => ({
      ...d,
      favourites: next ? [...d.favourites, key] : d.favourites.filter((k) => k !== key),
    }));
    void window.api?.pack
      .setFavourite(key, next)
      .then((list) => setData((d) => ({ ...d, favourites: list })))
      .catch(() => undefined);
  };

  const selectedUrl = selected ? resolvePackMediaUrl(selected.file, KIND_DIR[selected.kind]) : "";

  return (
    <Stack gap="md" data-testid="gallery-panel">
      <Group justify="space-between" align="center" wrap="wrap">
        <div>
          <Text fw={700} size="lg">
            Pack Gallery
          </Text>
          <Text size="sm" c="dimmed">
            {data.entries.length} files · {data.moods.length} moods · active moods unlock
            their content for popups
          </Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <Chip
            checked={favouritesOnly}
            onClick={() => setFavouritesOnly((v) => !v)}
            size="xs"
            data-testid="gallery-favourites-chip"
          >
            <span data-testid="gallery-chip-favourites">
              <Group gap={4} wrap="nowrap">
                <IconStarFilled size={12} />
                Favourites ({data.favourites.length})
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
            data-testid="gallery-type-filter"
          />
        </Group>
      </Group>

      <Group gap="xs" wrap="wrap" data-testid="gallery-mood-chips">
        <Chip
          checked={moodFilter === null}
          onClick={() => setMoodFilter(null)}
          size="xs"
          data-testid="gallery-mood-all"
        >
          <span data-testid="gallery-chip-all">All</span>
        </Chip>
        <Chip
          checked={moodFilter === "default"}
          onClick={() => setMoodFilter("default")}
          size="xs"
          data-testid="gallery-mood-default"
        >
          <span data-testid="gallery-chip-default">default</span>
        </Chip>
        {data.moods.map((mood) => (
          <Chip
            key={mood}
            checked={moodFilter === mood}
            onClick={() => setMoodFilter(mood)}
            size="xs"
            data-testid={`gallery-mood-${mood}`}
          >
            <Group gap={4} wrap="nowrap" data-testid={`gallery-chip-${mood}`}>
              {mood}
              {active.has(mood) ? (
                <Badge size="xs" color="teal" variant="light">
                  active
                </Badge>
              ) : (
                <Badge size="xs" color="gray" variant="light" leftSection={<IconLock size={9} />}>
                  locked
                </Badge>
              )}
            </Group>
          </Chip>
        ))}
      </Group>

      {loading ? (
        <Text c="dimmed">Loading pack contents…</Text>
      ) : visible.length === 0 ? (
        <Center h={200}>
          <Text c="dimmed">
            {data.entries.length === 0
              ? "The active pack ships no media files."
              : favouritesOnly && data.favourites.length === 0
                ? "No favourites yet — star files to collect them here."
                : "No files match this filter."}
          </Text>
        </Center>
      ) : (
        <ScrollArea h="calc(100vh - 260px)" type="auto">
          <SimpleGrid cols={{ base: 3, sm: 4, md: 5, lg: 6 }} spacing="md" verticalSpacing="md">
            {visible.map((entry) => (
              <Stack
                key={`${entry.kind}:${entry.file}`}
                gap={4}
                data-testid={`gallery-card-${entry.file}`}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(entry)}
              >
                <div style={{ position: "relative" }}>
                  <Thumb entry={entry} />
                  <UnstyledButton
                    aria-label={favouriteKeys.has(favouriteKey(entry)) ? `Unstar ${entry.file}` : `Star ${entry.file}`}
                    data-testid={`gallery-star-${entry.file}`}
                    style={{ position: "absolute", top: 4, right: 4, padding: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.45)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavourite(entry);
                    }}
                  >
                    {favouriteKeys.has(favouriteKey(entry)) ? (
                      <IconStarFilled size={16} color="#ffd43b" />
                    ) : (
                      <IconStar size={16} color="rgba(255,255,255,0.8)" />
                    )}
                  </UnstyledButton>
                </div>
                <Text size="xs" truncate title={entry.file}>
                  {entry.file}
                </Text>
                <Group gap={4} wrap="wrap">
                  {entry.moods.length === 0 ? (
                    <Badge size="xs" variant="light" color="dark">
                      default
                    </Badge>
                  ) : (
                    entry.moods.map((mood) => (
                      <Badge
                        key={mood}
                        size="xs"
                        variant="light"
                        color={active.has(mood) ? "teal" : "gray"}
                        data-testid={`gallery-badge-${entry.file}-${mood}`}
                      >
                        {mood}
                      </Badge>
                    ))
                  )}
                </Group>
              </Stack>
            ))}
          </SimpleGrid>
        </ScrollArea>
      )}

      <Modal
        opened={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.file}
        size="lg"
        centered
        closeButtonProps={{ "aria-label": "Close gallery view" }}
      >
        <div data-testid="gallery-modal">
          {selected?.kind === "image" ? (
            <img src={selectedUrl} alt="" style={{ width: "100%", objectFit: "contain" }} />
          ) : selected?.kind === "video" ? (
            <video src={selectedUrl} controls autoPlay style={{ width: "100%" }} />
          ) : selected ? (
            <audio src={selectedUrl} controls autoPlay style={{ width: "100%" }} />
          ) : null}
        </div>
      </Modal>
    </Stack>
  );
}
