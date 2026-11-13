import { SimpleGrid } from "@mantine/core";
import { IconDevices } from "@tabler/icons-react";
import { ConfigDropdown, ConfigSlider, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function ModesPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const popupRenderMode = useSettingsStore((s) => s.popupRenderMode);
  const lkToggle = useSettingsStore((s) => s.lkToggle);
  const lkCorner = useSettingsStore((s) => s.lkCorner);
  const mitosisMode = useSettingsStore((s) => s.mitosisMode);
  const mitosisStrength = useSettingsStore((s) => s.mitosisStrength);
  const hibernateMode = useSettingsStore((s) => s.hibernateMode);
  const hibernateType = useSettingsStore((s) => s.hibernateType);
  const hibernateMin = useSettingsStore((s) => s.hibernateMin);
  const hibernateMax = useSettingsStore((s) => s.hibernateMax);
  const wakeupActivity = useSettingsStore((s) => s.wakeupActivity);
  const hibernateLength = useSettingsStore((s) => s.hibernateLength);
  const fixWallpaper = useSettingsStore((s) => s.fixWallpaper);

  const hibernateData = [
    { label: "Original", value: "Original" },
    { label: "Spaced", value: "Spaced" },
    { label: "Glitch", value: "Glitch" },
    { label: "Ramp", value: "Ramp" },
    { label: "Pump-Scare", value: "Pump-Scare" },
    { label: "Chaos", value: "Chaos" },
  ];

  const cornerData = [
    { label: "Top Right", value: "0" },
    { label: "Top Left", value: "1" },
    { label: "Bottom Left", value: "2" },
    { label: "Bottom Right", value: "3" },
    { label: "Random", value: "4" },
  ];

  return (
    <SectionCard
      icon={<IconDevices size={16} />}
      title="Runtime Modes"
      description="How popups render, plus mitosis and hibernate."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigDropdown
          label="Popup Render Mode"
          value={popupRenderMode}
          onChange={(val) => setRaw({ popupRenderMode: val as "electron" | "inapp" })}
          data={[
            { label: "Electron Windows (Topmost)", value: "electron" },
            { label: "In-App Overlay", value: "inapp" },
          ]}
          description="How popups are rendered. Electron mode uses separate OS windows; In-App renders within this window."
        />

        <ConfigToggle
          label="Lowkey Mode"
          value={lkToggle}
          onChange={(val) => setRaw({ lkToggle: val })}
          description="Enable lowkey mode (smaller popups in corners)"
        />

        <ConfigDropdown
          label="Lowkey Corner"
          value={lkCorner.toString()}
          onChange={(val) => setRaw({ lkCorner: Number(val) })}
          data={cornerData}
          disabled={!lkToggle}
          description="Corner for lowkey popups"
        />

        <ConfigToggle
          label="Mitosis Mode"
          value={mitosisMode}
          onChange={(val) => setRaw({ mitosisMode: val })}
          danger
          description="Auto-spawn popups when count reaches zero"
        />

        <ConfigSlider
          label="Mitosis Strength"
          value={mitosisStrength}
          onChange={(val) => setRaw({ mitosisStrength: val })}
          min={0}
          max={10}
          step={1}
          disabled={!mitosisMode}
          description="Number of popups to spawn on mitosis trigger"
        />

        <ConfigToggle
          label="Hibernate Mode"
          value={hibernateMode}
          onChange={(val) => setRaw({ hibernateMode: val })}
          description="Enable hibernate mode (background popup bursts)"
        />

        <ConfigDropdown
          label="Hibernate Type"
          value={hibernateType}
          onChange={(val) => setRaw({ hibernateType: val })}
          data={hibernateData}
          disabled={!hibernateMode}
          description="Burst pattern type"
        />

        <ConfigSlider
          label="Hibernate Min Delay"
          value={hibernateMin}
          onChange={(val) => setRaw({ hibernateMin: val })}
          min={0}
          max={300000}
          step={1000}
          disabled={!hibernateMode}
          description="Minimum delay between bursts (ms)"
        />

        <ConfigSlider
          label="Hibernate Max Delay"
          value={hibernateMax}
          onChange={(val) => setRaw({ hibernateMax: val })}
          min={0}
          max={300000}
          step={1000}
          disabled={!hibernateMode}
          description="Maximum delay between bursts (ms)"
        />

        <ConfigSlider
          label="Wake Activity Duration"
          value={wakeupActivity}
          onChange={(val) => setRaw({ wakeupActivity: val })}
          min={0}
          max={300000}
          step={1000}
          disabled={!hibernateMode}
          description="Duration of active burst (ms)"
        />

        <ConfigSlider
          label="Hibernate Burst Length"
          value={hibernateLength}
          onChange={(val) => setRaw({ hibernateLength: val })}
          min={0}
          max={300000}
          step={1000}
          disabled={!hibernateMode}
          description="Total hibernation duration (ms)"
        />

        <ConfigToggle
          label="Fix Wallpaper After Hibernate"
          value={fixWallpaper}
          onChange={(val) => setRaw({ fixWallpaper: val })}
          disabled={!hibernateMode}
          description="Restore original wallpaper after hibernate ends"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
