import { SimpleGrid, Stack, Text, Tooltip, Button, Group } from "@mantine/core";
import { IconPlayerPlay, IconClock, IconWand } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useSettingsStore } from "../../../../stores";
import { filterKnownSettings } from "../../../../stores/settingsStore";
import { ConfigDropdown, ConfigField, ConfigToggle } from "../../../Config";
import { SectionCard } from "../../../SectionCard";
import { normalizePackConfigValues } from "../../../../features/corruption/legacyConfig";

const TIME_UNITS = [
  { label: "Minutes", value: "Minutes" },
  { label: "Hours", value: "Hours" },
  { label: "Days", value: "Days" },
];

/**
 * Applies the active pack's suggested configuration (its config.json), like
 * the legacy "apply preset" control on the Start tab.
 */
function PackPresetCard() {
  const setRaw = useSettingsStore((state) => state.setRaw);
  const packPath = useSettingsStore((state) => state.packPath);
  const [preset, setPreset] = useState<Record<string, unknown> | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setApplied(false);
    setPreset(null);
    if (!packPath) return;
    let alive = true;
    void window.api?.pack
      .loadPackConfig()
      .then((cfg) => {
        if (alive) setPreset(cfg && Object.keys(cfg).length > 0 ? cfg : null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [packPath]);

  if (!preset) return null;
  const count = Object.keys(preset).length;

  return (
    <SectionCard
      icon={<IconWand size={16} />}
      title="Pack Preset"
      description="The pack ships suggested configuration values."
    >
      <Group gap="md" wrap="wrap">
        <Text size="sm" c="dimmed">
          {count} suggested setting{count === 1 ? "" : "s"}
        </Text>
        <Button
          size="xs"
          variant="light"
          data-testid="apply-pack-preset"
          onClick={() => {
            setRaw(filterKnownSettings(normalizePackConfigValues(preset)));
            setApplied(true);
          }}
        >
          Apply pack preset
        </Button>
        {applied ? (
          <Text size="sm" c="teal" data-testid="preset-applied">
            Preset applied.
          </Text>
        ) : null}
      </Group>
    </SectionCard>
  );
}

export function StartPanel() {
  const setRaw = useSettingsStore((state) => state.setRaw);
  const packPath = useSettingsStore((state) => state.packPath);
  const themeType = useSettingsStore((state) => state.themeType);
  const globalPanicButton = useSettingsStore((state) => state.globalPanicButton);
  const lkCorner = useSettingsStore((state) => state.lkCorner);
  const schedule = useSettingsStore((state) => state.schedule);
  const scheduleTime = useSettingsStore((state) => state.scheduleTime);
  const timeType = useSettingsStore((state) => state.timeType);
  const varianceTime = useSettingsStore((state) => state.varianceTime);
  const varianceType = useSettingsStore((state) => state.varianceType);
  const repeatSchedule = useSettingsStore((state) => state.repeatSchedule);
  const repeatTime = useSettingsStore((state) => state.repeatTime);
  const repeatType = useSettingsStore((state) => state.repeatType);

  const themeData = [
    { label: "Original", value: "Original" },
    { label: "Dark", value: "Dark" },
    { label: "The One", value: "The One" },
    { label: "Ransom", value: "Ransom" },
    { label: "Goth", value: "Goth" },
    { label: "Bimbo", value: "Bimbo" },
  ];

  const cornerData = [
    { label: "Top Right", value: "0" },
    { label: "Top Left", value: "1" },
    { label: "Bottom Left", value: "2" },
    { label: "Bottom Right", value: "3" },
    { label: "Random", value: "4" },
  ];

  return (
    <Stack gap="lg">
    <SectionCard
      icon={<IconPlayerPlay size={16} />}
      title="Start Settings"
      description="Appearance and startup options."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigDropdown
          label="Theme"
          value={themeType}
          onChange={(value) => setRaw({ themeType: value })}
          data={themeData}
          description="Colour theme for the application"
          testId="theme-select"
        />

        <ConfigField
          label="Global Panic Button"
          value={globalPanicButton}
          onChange={() => {}}
          disabled
          description="Hotkey to panic and close the application"
        />

        <ConfigDropdown
          label="Lowkey Corner"
          value={lkCorner}
          onChange={() => {}}
          data={cornerData}
          disabled
          description="Corner for lowkey mode popups"
        />

        {packPath ? (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Active pack
            </Text>
            <Tooltip
              label={packPath}
              position="bottom"
              multiline
              styles={{ tooltip: { maxWidth: 480, whiteSpace: "normal" } }}
            >
              <Text size="sm" truncate style={{ maxWidth: "100%" }}>
                {packPath}
              </Text>
            </Tooltip>
          </Stack>
        ) : (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Active pack
            </Text>
            <Text size="sm" c="dimmed">
              None — pick one in Pack Management.
            </Text>
          </Stack>
        )}
      </SimpleGrid>
    </SectionCard>

    <PackPresetCard />

      <SectionCard
        icon={<IconClock size={16} />}
        title="Scheduling"
        description="Start a session automatically after a delay. Repeat it if you like. The app must stay running, so pair it with run-at-startup."
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
          <ConfigToggle
            label="Enable Scheduling"
            value={schedule}
            onChange={(val) => setRaw({ schedule: val })}
            description="Start the runtime automatically after the delay below"
          />
          <ConfigToggle
            label="Repeat Schedule"
            value={repeatSchedule}
            onChange={(val) => setRaw({ repeatSchedule: val })}
            description="Re-arm the session every repeat interval"
            disabled={schedule !== 1}
          />
          <ConfigField
            label="Run In"
            type="number"
            value={scheduleTime}
            onChange={(val) => setRaw({ scheduleTime: Math.max(0, Number(val) || 0) })}
            description="Delay before the scheduled session starts"
            disabled={schedule !== 1}
          />
          <ConfigDropdown
            label="Delay Unit"
            value={timeType}
            onChange={(val) => setRaw({ timeType: val })}
            data={TIME_UNITS}
            disabled={schedule !== 1}
          />
          <ConfigField
            label="Random Delay Up To"
            type="number"
            value={varianceTime}
            onChange={(val) => setRaw({ varianceTime: Math.max(0, Number(val) || 0) })}
            description="Jitter the start by up to this much"
            disabled={schedule !== 1}
          />
          <ConfigDropdown
            label="Variance Unit"
            value={varianceType}
            onChange={(val) => setRaw({ varianceType: val })}
            data={TIME_UNITS}
            disabled={schedule !== 1}
          />
          <ConfigField
            label="Repeat Every"
            type="number"
            value={repeatTime}
            onChange={(val) => setRaw({ repeatTime: Math.max(0, Number(val) || 0) })}
            description="Interval between repeated sessions"
            disabled={schedule !== 1 || repeatSchedule !== 1}
          />
          <ConfigDropdown
            label="Repeat Unit"
            value={repeatType}
            onChange={(val) => setRaw({ repeatType: val })}
            data={TIME_UNITS}
            disabled={schedule !== 1 || repeatSchedule !== 1}
          />
        </SimpleGrid>
      </SectionCard>
    </Stack>
  );
}
