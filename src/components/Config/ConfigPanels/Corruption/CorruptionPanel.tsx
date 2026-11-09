import { Alert, SimpleGrid } from "@mantine/core";
import { IconSkull } from "@tabler/icons-react";
import { ConfigDropdown, ConfigSlider, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { useCorruptionStore } from "../../../../stores/corruptionStore";
import { SectionCard } from "../../../SectionCard";

export function CorruptionPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const corruptionError = useCorruptionStore((s) => s.corruptionError);
  const corruptionMode = useSettingsStore((s) => s.corruptionMode);
  const corruptionFullPerm = useSettingsStore((s) => s.corruptionFullPerm);
  const corruptionTrigger = useSettingsStore((s) => s.corruptionTrigger);
  const corruptionFadeType = useSettingsStore((s) => s.corruptionFadeType);
  const corruptionTime = useSettingsStore((s) => s.corruptionTime);
  const corruptionPopups = useSettingsStore((s) => s.corruptionPopups);
  const corruptionLaunches = useSettingsStore((s) => s.corruptionLaunches);
  const corruptionWallpaperCycle = useSettingsStore((s) => s.corruptionWallpaperCycle);
  const corruptionThemeCycle = useSettingsStore((s) => s.corruptionThemeCycle);
  const corruptionPurityMode = useSettingsStore((s) => s.corruptionPurityMode);
  const corruptionDevMode = useSettingsStore((s) => s.corruptionDevMode);

  const triggerData = [
    { label: "Timed", value: "Timed" },
    { label: "Popup Count", value: "Popup" },
    { label: "Launch Count", value: "Launch" },
    { label: "Script-Driven", value: "Script" },
  ];

  const fadeData = [
    { label: "Normal", value: "Normal" },
    { label: "Abrupt", value: "Abrupt" },
  ];

  return (
    <SectionCard
      icon={<IconSkull size={16} />}
      title="Corruption Mode (Guided Mode)"
      description="Escalating guided mode driven by pack level transitions."
    >
      {corruptionError ? (
        <Alert color="yellow" variant="light" mb="md" data-testid="corruption-error-banner">
          {corruptionError}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Enable Corruption Mode"
          value={corruptionMode}
          onChange={(val) => setRaw({ corruptionMode: val })}
          disabled
          description="Enable guided mode with level transitions"
        />

        <ConfigToggle
          label="Full Permissions"
          value={corruptionFullPerm}
          onChange={(val) => setRaw({ corruptionFullPerm: val })}
          disabled
          description="Allow pack to modify Edgeware settings"
        />

        <ConfigDropdown
          label="Trigger Type"
          value={corruptionTrigger}
          onChange={(val) => setRaw({ corruptionTrigger: val })}
          data={triggerData}
          disabled={!corruptionMode}
          description="What triggers level transitions"
        />

        <ConfigDropdown
          label="Fade Type"
          value={corruptionFadeType}
          onChange={(val) => setRaw({ corruptionFadeType: val })}
          data={fadeData}
          disabled={!corruptionMode}
          description="Transition visual effect"
        />

        <ConfigSlider
          label="Time Per Level"
          value={corruptionTime}
          onChange={(val) => setRaw({ corruptionTime: val })}
          min={0}
          max={3600000}
          step={1000}
          disabled={!corruptionMode}
          description="Duration per corruption level (ms)"
        />

        <ConfigSlider
          label="Popup Count Trigger"
          value={corruptionPopups}
          onChange={(val) => setRaw({ corruptionPopups: val })}
          min={0}
          max={1000}
          step={1}
          disabled={!corruptionMode}
          description="Popups before transition (if popup trigger)"
        />

        <ConfigSlider
          label="Launch Count Trigger"
          value={corruptionLaunches}
          onChange={(val) => setRaw({ corruptionLaunches: val })}
          min={0}
          max={1000}
          step={1}
          disabled={!corruptionMode}
          description="Launches before transition (if launch trigger)"
        />

        <ConfigToggle
          label="Cycle Wallpaper in Corruption"
          value={corruptionWallpaperCycle}
          onChange={(val) => setRaw({ corruptionWallpaperCycle: val })}
          disabled={!corruptionMode}
          description="Change wallpaper on each level"
        />

        <ConfigToggle
          label="Cycle Themes in Corruption"
          value={corruptionThemeCycle}
          onChange={(val) => setRaw({ corruptionThemeCycle: val })}
          disabled={!corruptionMode}
          description="Change theme on each level"
        />

        <ConfigToggle
          label="Purity Mode"
          value={corruptionPurityMode}
          onChange={(val) => setRaw({ corruptionPurityMode: val })}
          disabled={!corruptionMode}
          description="Reverse corruption progression"
        />

        <ConfigToggle
          label="Dev Mode"
          value={corruptionDevMode}
          onChange={(val) => setRaw({ corruptionDevMode: val })}
          disabled
          description="Enable development features"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
