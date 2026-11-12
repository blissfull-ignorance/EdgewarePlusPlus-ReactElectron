/**
 * @file DesignerSection — no-code corruption script builder.
 *
 * Levels are edited as cards (moods to activate/deactivate, wallpaper,
 * content actions, and how the next level is reached) and saved as a
 * coordinated script.lua + corruption.json pair. The design round-trips
 * through a marker block inside the generated script, so a designed pack can
 * always be reopened for editing; hand-written scripts stay editable on the
 * code tab.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import type { GalleryEntry, GalleryResult } from "../../types/pack";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  emptyDesign,
  generateCorruptionJson,
  generateLua,
  normalizeDesign,
  parseDesignerScript,
  type DesignerAction,
  type DesignerLevel,
  type DesignerScript,
} from "./designerModel";

interface RawMood {
  mood: string;
  [key: string]: unknown;
}

function parseIndexMoods(index: Record<string, unknown> | null): RawMood[] {
  const moods = index?.moods;
  if (!Array.isArray(moods)) return [];
  return moods.filter(
    (m): m is RawMood => !!m && typeof m === "object" && typeof (m as RawMood).mood === "string"
  );
}

const ACTION_KINDS: { value: DesignerAction["kind"]; label: string }[] = [
  { value: "image", label: "Show image" },
  { value: "video", label: "Show video" },
  { value: "audio", label: "Play audio" },
  { value: "notification", label: "Notification" },
  { value: "prompt", label: "Prompt (text box)" },
  { value: "subliminal", label: "Subliminal text" },
  { value: "web", label: "Open URL" },
  { value: "close_popups", label: "Close popups" },
  { value: "set_close_text", label: "Close label" },
];

const FILE_ACTIONS: DesignerAction["kind"][] = ["image", "video", "audio"];
const TEXT_ACTIONS: DesignerAction["kind"][] = [
  "notification",
  "prompt",
  "subliminal",
  "web",
  "set_close_text",
];

function filesOf(gallery: GalleryResult, kind: GalleryEntry["kind"]): string[] {
  return gallery.entries.filter((e) => e.kind === kind).map((e) => e.file);
}

function newLevel(): DesignerLevel {
  return {
    addMoods: [],
    removeMoods: [],
    wallpaper: null,
    actions: [],
    advance: { mode: "time", seconds: 10 },
    config: {},
  };
}

function LevelCard({
  index,
  level,
  isLast,
  moodNames,
  images,
  videos,
  audios,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}: {
  index: number;
  level: DesignerLevel;
  isLast: boolean;
  moodNames: string[];
  images: string[];
  videos: string[];
  audios: string[];
  onChange: (next: DesignerLevel) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const patch = (part: Partial<DesignerLevel>): void => onChange({ ...level, ...part });

  const toggleListMood = (field: "addMoods" | "removeMoods", mood: string): void => {
    const list = level[field];
    patch({ [field]: list.includes(mood) ? list.filter((m) => m !== mood) : [...list, mood] } as Partial<DesignerLevel>);
  };

  const referenced = new Set([...level.addMoods, ...level.removeMoods]);
  const staleMoods = [...referenced].filter((m) => !moodNames.includes(m));
  const dropStaleMood = (mood: string): void =>
    patch({
      addMoods: level.addMoods.filter((m) => m !== mood),
      removeMoods: level.removeMoods.filter((m) => m !== mood),
    });

  const setAction = (i: number, next: DesignerAction): void =>
    patch({ actions: level.actions.map((a, idx) => (idx === i ? next : a)) });
  const addAction = (kind: DesignerAction["kind"]): void =>
    patch({ actions: [...level.actions, { kind }] });
  const removeAction = (i: number): void => patch({ actions: level.actions.filter((_, idx) => idx !== i) });

  return (
    <div data-testid={`designer-level-${index}`}>
    <Stack gap="sm" p="sm" style={{ border: "1px solid var(--mantine-color-dark-4)", borderRadius: 8 }}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          Level {index + 1}
        </Text>
        <Group gap={4}>
          <Button size="xs" variant="subtle" aria-label="Move level up" disabled={index === 0} onClick={() => onMove(-1)}>
            <IconArrowUp size={14} />
          </Button>
          <Button
            size="xs"
            variant="subtle"
            aria-label="Move level down"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <IconArrowDown size={14} />
          </Button>
          <Button size="xs" variant="subtle" aria-label="Duplicate level" data-testid={`designer-level-duplicate-${index}`} onClick={onDuplicate}>
            <IconCopy size={14} />
          </Button>
          <Button size="xs" variant="subtle" color="red" aria-label="Delete level" data-testid={`designer-level-remove-${index}`} onClick={onRemove}>
            <IconTrash size={14} />
          </Button>
        </Group>
      </Group>

      <Group gap="xs" wrap="wrap">
        <Text size="xs" c="dimmed" w={110}>
          Activate moods
        </Text>
        {moodNames.map((mood) => (
          <Chip
            key={mood}
            size="xs"
            checked={level.addMoods.includes(mood)}
            onChange={() => toggleListMood("addMoods", mood)}
          >
            <span data-testid={`designer-add-${index}-${mood}`}>{mood}</span>
          </Chip>
        ))}
        {moodNames.length === 0 ? <Text size="xs" c="dimmed">no moods yet — add them under Mood tagging</Text> : null}
        {staleMoods.map((mood) => (
          <Chip
            key={`ghost-${mood}`}
            size="xs"
            color="orange"
            variant="light"
            checked
            onChange={() => dropStaleMood(mood)}
          >
            <span data-testid={`designer-stale-${index}-${mood}`} title="Mood no longer exists in the pack — click to drop it">
              {mood} (missing)
            </span>
          </Chip>
        ))}
      </Group>

      <Group gap="xs" wrap="wrap">
        <Text size="xs" c="dimmed" w={110}>
          Deactivate moods
        </Text>
        {moodNames.map((mood) => (
          <Chip
            key={mood}
            size="xs"
            checked={level.removeMoods.includes(mood)}
            onChange={() => toggleListMood("removeMoods", mood)}
          >
            <span data-testid={`designer-remove-${index}-${mood}`}>{mood}</span>
          </Chip>
        ))}
      </Group>

      <Group gap="sm" wrap="wrap">
        <Select
          size="xs"
          label="Wallpaper"
          w={200}
          data={[{ value: "", label: "— none —" }, ...images.map((f) => ({ value: f, label: f }))]}
          value={level.wallpaper ?? ""}
          onChange={(v) => patch({ wallpaper: v ? v : null })}
          data-testid={`designer-wallpaper-${index}`}
          aria-label={`Wallpaper for level ${index + 1}`}
        />
        <NumberInput
          size="xs"
          w={130}
          min={0}
          max={100}
          label="Popup rate %"
          placeholder="pack"
          value={level.config?.popupMod ?? ""}
          onChange={(v) =>
            patch({
              config: { ...level.config, popupMod: typeof v === "number" ? v : undefined },
            })
          }
          data-testid={`designer-popupmod-${index}`}
          aria-label={`Popup rate percent for level ${index + 1}`}
        />
        <NumberInput
          size="xs"
          w={130}
          min={0}
          step={500}
          label="Spawn delay ms"
          placeholder="pack"
          value={level.config?.delay ?? ""}
          onChange={(v) =>
            patch({
              config: { ...level.config, delay: typeof v === "number" ? v : undefined },
            })
          }
          data-testid={`designer-delay-${index}`}
          aria-label={`Spawn delay milliseconds for level ${index + 1}`}
        />
      </Group>

      <Stack gap={6}>
        <Text size="xs" c="dimmed">
          Content shown at this level
        </Text>
        {level.actions.map((action, i) => (
          <Group key={i} gap="xs" wrap="nowrap" data-testid={`designer-action-${index}-${i}`}>
            <Select
              size="xs"
              w={150}
              data={ACTION_KINDS.map((k) => ({ value: k.value, label: k.label }))}
              value={action.kind}
              onChange={(v) => setAction(i, { kind: (v as DesignerAction["kind"]) ?? action.kind, file: undefined, text: undefined })}
              aria-label={`Action ${i + 1} type`}
            />
            {FILE_ACTIONS.includes(action.kind) ? (
              <Select
                size="xs"
                w={200}
                data={action.kind === "image" ? images : action.kind === "video" ? videos : audios}
                value={action.file ?? null}
                placeholder="random from pool"
                clearable
                onChange={(v) => setAction(i, { ...action, file: v ?? undefined })}
                aria-label={`Action ${i + 1} file`}
              />
            ) : TEXT_ACTIONS.includes(action.kind) ? (
              <TextInput
                size="xs"
                w={200}
                placeholder={action.kind === "web" ? "https://url" : "text (optional — pack pool otherwise)"}
                value={action.text ?? ""}
                onChange={(e) => setAction(i, { ...action, text: e.currentTarget.value })}
                aria-label={`Action ${i + 1} text`}
              />
            ) : null}
            {action.kind !== "close_popups" ? (
              <NumberInput
                size="xs"
                w={110}
                min={1}
                max={99}
                suffix=" %"
                placeholder="always"
                value={action.chance ?? ""}
                onChange={(v) =>
                  setAction(i, {
                    ...action,
                    chance: typeof v === "number" && v >= 1 && v <= 99 ? v : undefined,
                  })
                }
                aria-label={`Action ${i + 1} chance percent`}
              />
            ) : null}
            <Button size="xs" variant="subtle" color="red" aria-label="Remove action" onClick={() => removeAction(i)}>
              <IconTrash size={12} />
            </Button>
          </Group>
        ))}
        <Group gap="xs">
          {ACTION_KINDS.map((k) => (
            <Button key={k.value} size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => addAction(k.value)} data-testid={`designer-add-action-${index}-${k.value}`}>
              {k.label}
            </Button>
          ))}
        </Group>
      </Stack>

      <Group gap="sm" wrap="wrap">
        <Text size="xs" c="dimmed" w={110}>
          Next level
        </Text>
        <SegmentedControl
          size="xs"
          data={[
            { label: "After delay", value: "time" },
            { label: "When audio ends", value: "audio" },
            { label: "Final", value: "end" },
          ]}
          value={isLast ? "end" : level.advance.mode}
          disabled={isLast}
          onChange={(v) => {
            patch({
              advance:
                v === "audio"
                  ? { mode: "audio", file: audios[0] ?? "" }
                  : v === "time"
                    ? { mode: "time", seconds: 10 }
                    : { mode: "end" },
            });
          }}
          data-testid={`designer-advance-${index}`}
        />
        {!isLast && level.advance.mode === "time" ? (
          <NumberInput
            size="xs"
            w={110}
            min={1}
            suffix=" s"
            value={level.advance.seconds}
            onChange={(v) => patch({ advance: { mode: "time", seconds: typeof v === "number" && v > 0 ? v : 10 } })}
            aria-label="Seconds until next level"
            data-testid={`designer-advance-seconds-${index}`}
          />
        ) : null}
        {!isLast && level.advance.mode === "audio" ? (
          <Select
            size="xs"
            w={220}
            data={audios}
            value={level.advance.file || null}
            placeholder="audio file for this level"
            onChange={(v) => {
              // Re-clicking the selected option deselects (null); the audio
              // advance requires a file, so only a real pick changes it.
              if (v) patch({ advance: { mode: "audio", file: v } });
            }}
            aria-label="Audio that advances the level"
            data-testid={`designer-advance-audio-${index}`}
          />
        ) : null}
      </Group>
    </Stack>
    </div>
  );
}

export function DesignerSection({ packRevision = 0 }: { packRevision?: number }) {
  const packPath = useSettingsStore((s) => s.packPath);
  const [gallery, setGallery] = useState<GalleryResult>({ entries: [], moods: [], activeMoods: [], favourites: [] });
  const [moodNames, setMoodNames] = useState<string[]>([]);
  const [design, setDesign] = useState<DesignerScript>(emptyDesign());
  const [sourceMode, setSourceMode] = useState<"visual" | "code">("visual");
  const [code, setCode] = useState("");
  const [hasExistingScript, setHasExistingScript] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  // True once the visual design diverged from the script on disk; only then
  // does switching to the code tab regenerate the source from the design.
  const [designDirty, setDesignDirty] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);
  const [scriptTooLarge, setScriptTooLarge] = useState(false);

  /** Refresh the pack's file/mood inventory without touching the design. */
  const reloadPackData = useCallback(async () => {
    if (!packPath) return;
    const [g, idx] = await Promise.all([
      window.api?.pack.listGallery(packPath),
      window.api?.pack.getEditableIndex(packPath),
    ]);
    if (g) setGallery(g);
    setMoodNames(parseIndexMoods(idx ?? null).map((m) => m.mood));
  }, [packPath]);

  /** Re-read the design and script from disk, replacing any unsaved edits. */
  const reload = useCallback(async () => {
    if (!packPath) return;
    await reloadPackData();
    const script = await window.api?.scripting.readScript(packPath);
    if (script) {
      setHasExistingScript(script.exists);
      setScriptTooLarge(script.tooLarge === true);
      const designed = parseDesignerScript(script.content);
      setDesign(designed ?? emptyDesign());
      setCode(script.content);
      setDesignDirty(false);
      setCodeDirty(false);
    }
  }, [packPath, reloadPackData]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  useEffect(() => {
    if (packRevision === 0) return;
    // With unsaved visual edits the design stays as authored (stale mood
    // references surface as warnings); otherwise re-read the disk so
    // renames and removals propagated by the tagging view are picked up.
    void (designDirty || codeDirty ? reloadPackData() : reload()).catch(() => undefined);
  }, [packRevision, reloadPackData, reload, designDirty, codeDirty]);

  const images = useMemo(() => filesOf(gallery, "image"), [gallery]);
  const videos = useMemo(() => filesOf(gallery, "video"), [gallery]);
  const audios = useMemo(() => filesOf(gallery, "audio"), [gallery]);

  // References that no longer resolve inside the pack, surfaced before save
  // so a renamed mood or deleted file is visible instead of silently skipped.
  const warnings = useMemo(() => {
    const issues: string[] = [];
    const imageSet = new Set(images);
    const videoSet = new Set(videos);
    const audioSet = new Set(audios);
    design.levels.forEach((level, i) => {
      for (const mood of new Set([...level.addMoods, ...level.removeMoods])) {
        if (!moodNames.includes(mood)) {
          issues.push(`Level ${i + 1}: mood "${mood}" no longer exists in the pack`);
        }
      }
      if (level.wallpaper && !imageSet.has(level.wallpaper)) {
        issues.push(`Level ${i + 1}: wallpaper "${level.wallpaper}" is not in the pack`);
      }
      if (level.advance.mode === "audio" && !audioSet.has(level.advance.file)) {
        issues.push(`Level ${i + 1}: advance audio "${level.advance.file || "(none)"}" is not in the pack`);
      }
      level.actions.forEach((a, j) => {
        if (a.kind === "image" && a.file && !imageSet.has(a.file)) {
          issues.push(`Level ${i + 1}, action ${j + 1}: image "${a.file}" is not in the pack`);
        }
        if (a.kind === "video" && a.file && !videoSet.has(a.file)) {
          issues.push(`Level ${i + 1}, action ${j + 1}: video "${a.file}" is not in the pack`);
        }
      });
    });
    return issues;
  }, [design, moodNames, images, videos, audios]);

  const setLevel = (i: number, next: DesignerLevel): void => {
    setDesignDirty(true);
    setDesign((d) => ({ ...d, levels: d.levels.map((l, idx) => (idx === i ? next : l)) }));
  };

  const moveLevel = (i: number, dir: -1 | 1): void => {
    setDesignDirty(true);
    setDesign((d) => {
      const levels = [...d.levels];
      const j = i + dir;
      if (j < 0 || j >= levels.length) return d;
      [levels[i], levels[j]] = [levels[j], levels[i]];
      return { ...d, levels };
    });
  };

  const removeLevel = (i: number): void => {
    setDesignDirty(true);
    setDesign((d) => ({ ...d, levels: d.levels.filter((_, idx) => idx !== i) }));
  };

  const duplicateLevel = (i: number): void => {
    setDesignDirty(true);
    setDesign((d) => {
      const levels = [...d.levels];
      levels.splice(i + 1, 0, JSON.parse(JSON.stringify(levels[i])) as DesignerLevel);
      return { ...d, levels };
    });
  };

  const save = (andRun = false): void => {
    if (!packPath) return;
    // The code tab is authoritative for the script there; its embedded
    // marker (when present) is authoritative for the level tables, so the
    // two artifacts can never describe different designs.
    const effective = normalizeDesign(
      sourceMode === "code" ? (parseDesignerScript(code) ?? design) : design
    );
    const lua = sourceMode === "code" ? code : generateLua(effective);
    // A design with no levels describes nothing; leave the pack's existing
    // corruption.json alone instead of wiping a hand-authored progression.
    const corruptionJson =
      effective.levels.length > 0 ? generateCorruptionJson(effective) : null;
    void window.api?.scripting
      .writePackDesign(packPath, lua, corruptionJson)
      .then((ok) => {
        setStatus(ok ? "saved" : "failed");
        if (!ok) return;
        setCode(lua);
        setDesign(effective);
        setDesignDirty(false);
        setCodeDirty(false);
        if (andRun) void window.api?.scripting.runLua("script.lua").catch(() => undefined);
        void reload().catch(() => undefined);
      })
      .catch(() => setStatus("failed"));
  };

  if (!packPath) {
    return <Text c="dimmed">Select a pack first (Status tab or Pack Management).</Text>;
  }

  const designed = parseDesignerScript(code) !== null || !hasExistingScript;

  return (
    <Stack gap="md" data-testid="creator-designer">
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <NumberInput
            size="xs"
            w={140}
            min={0}
            label="First level after"
            suffix=" s"
            value={design.startDelaySeconds}
            onChange={(v) => {
              setDesignDirty(true);
              setDesign((d) => ({ ...d, startDelaySeconds: typeof v === "number" && v >= 0 ? v : 2 }));
            }}
            data-testid="designer-start-delay"
            aria-label="First level delay seconds"
          />
          <SegmentedControl
            size="xs"
            data={[
              { label: "Visual", value: "visual" },
              { label: "Code", value: "code" },
            ]}
            value={sourceMode}
            onChange={(v) => {
              if (v === "code") setCode(designDirty ? generateLua(design) : code);
              if (v === "visual") {
                const parsed = parseDesignerScript(code);
                if (parsed) {
                  setDesign(parsed);
                  setDesignDirty(false);
                }
              }
              setSourceMode(v as "visual" | "code");
            }}
            data-testid="designer-mode-toggle"
          />
        </Group>
        <Group gap="sm">
          <Button size="xs" onClick={() => save()} disabled={scriptTooLarge} data-testid="designer-save">
            Save design to pack
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => save(true)}
            disabled={scriptTooLarge}
            data-testid="designer-test-run"
          >
            Save & test run
          </Button>
          {status === "saved" ? (
            <Text size="sm" c="teal" data-testid="designer-status">
              Saved script.lua + corruption.json.
            </Text>
          ) : status === "failed" ? (
            <Text size="sm" c="red" data-testid="designer-status">
              Could not save the design.
            </Text>
          ) : null}
        </Group>
      </Group>

      {scriptTooLarge ? (
        <Text size="sm" c="orange" data-testid="designer-toolarge-banner">
          This pack's script.lua is larger than the 200 KB in-app editing limit;
          saving is disabled so the file cannot be truncated.
        </Text>
      ) : null}

      {hasExistingScript && !designed ? (
        <Text size="sm" c="orange" data-testid="designer-handwritten-banner">
          This pack ships a hand-written script. The visual editor starts a new
          design; saving replaces the pack's script.lua (the code tab still
          shows the current file).
        </Text>
      ) : null}

      {sourceMode === "visual" && warnings.length > 0 ? (
        <Stack gap={2} data-testid="designer-warnings">
          {warnings.map((w) => (
            <Text key={w} size="xs" c="orange">
              {"\u26a0"} {w}
            </Text>
          ))}
        </Stack>
      ) : null}

      {sourceMode === "code" ? (
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value);
            setCodeDirty(true);
            setStatus("idle");
          }}
          spellCheck={false}
          aria-label="Generated script source"
          data-testid="designer-code"
          style={{
            width: "100%",
            minHeight: 360,
            fontFamily: "var(--mantine-font-family-monospace, monospace)",
            fontSize: 13,
            lineHeight: 1.5,
            backgroundColor: "var(--mantine-color-dark-8)",
            color: "var(--mantine-color-dark-0)",
            border: "1px solid var(--mantine-color-dark-4)",
            borderRadius: 8,
            padding: 12,
            resize: "vertical",
          }}
        />
      ) : (
        <>
          <ScrollArea h="calc(100vh - 380px)" type="auto">
            <Stack gap="sm">
              {design.levels.length === 0 ? (
                <Text c="dimmed">No levels yet — add the first one below.</Text>
              ) : null}
              {design.levels.map((level, i) => (
                <LevelCard
                  key={i}
                  index={i}
                  level={level}
                  isLast={i === design.levels.length - 1}
                  moodNames={moodNames}
                  images={images}
                  videos={videos}
                  audios={audios}
                  onChange={(next) => setLevel(i, next)}
                  onMove={(dir) => moveLevel(i, dir)}
                  onRemove={() => removeLevel(i)}
                  onDuplicate={() => duplicateLevel(i)}
                />
              ))}
            </Stack>
          </ScrollArea>
          <Group>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setDesignDirty(true);
                setDesign((d) => ({ ...d, levels: [...d.levels, newLevel()] }));
              }}
              data-testid="designer-add-level"
            >
              Add level
            </Button>
            <Badge variant="light" c="gray">
              {design.levels.length} level{design.levels.length === 1 ? "" : "s"}
            </Badge>
          </Group>
        </>
      )}
    </Stack>
  );
}
