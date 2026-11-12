import { SimpleGrid, Text } from "@mantine/core";
import { IconTools } from "@tabler/icons-react";
import { ConfigSlider, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function PopupTweaksPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const showCaptions = useSettingsStore((s) => s.showCaptions);
  const subliminalsAlpha = useSettingsStore((s) => s.subliminalsAlpha);
  const buttonless = useSettingsStore((s) => s.buttonless);
  const multiClick = useSettingsStore((s) => s.multiClick);
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const timeoutPopups = useSettingsStore((s) => s.timeoutPopups);
  const popupTimeout = useSettingsStore((s) => s.popupTimeout);
  const disabledMonitors = useSettingsStore((s) => s.disabledMonitors);
  const movingChance = useSettingsStore((s) => s.movingChance);
  const movingSpeed = useSettingsStore((s) => s.movingSpeed);
  const clickthroughPopups = useSettingsStore((s) => s.clickthroughPopups);
  const delay = useSettingsStore((s) => s.delay);

  return (
    <SectionCard
      icon={<IconTools size={16} />}
      title="Popup Tweaks"
      description="Fine-tune how popups behave."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Show Captions"
          value={showCaptions}
          onChange={(val) => setRaw({ showCaptions: val })}
          description="Display captions in popups"
        />

        <ConfigSlider
          label="Spawn Delay"
          value={delay}
          onChange={(val) => setRaw({ delay: val })}
          min={100}
          max={60000}
          step={100}
          description="Milliseconds between popup rolls — lower means more popups. At 100% image chance one popup spawns per roll (default 5000)."
          testId="config-spawn-delay"
        />

        <ConfigSlider
          label="Hypno Opacity"
          value={subliminalsAlpha}
          onChange={(val) => setRaw({ subliminalsAlpha: val })}
          min={0}
          max={100}
          description="Opacity for hypno/hypnosis overlays (0-100)"
        />

        <ConfigToggle
          label="Buttonless Mode"
          value={buttonless}
          onChange={(val) => setRaw({ buttonless: val })}
          description="Popups without close buttons"
        />

        <ConfigToggle
          label="Multi-Click Popups"
          value={multiClick}
          onChange={(val) => setRaw({ multiClick: val })}
          description="Popups require multiple clicks to close"
        />

        <ConfigSlider
          label="Lowkey Scaling"
          value={lkScaling}
          onChange={(val) => setRaw({ lkScaling: val })}
          min={0}
          max={100}
          description="Scaling factor for lowkey mode popups"
        />

        <ConfigToggle
          label="Timeout Popups"
          value={timeoutPopups}
          onChange={(val) => setRaw({ timeoutPopups: val })}
          description="Automatically close popups after timeout"
        />

        <ConfigSlider
          label="Popup Timeout"
          value={popupTimeout}
          onChange={(val) => setRaw({ popupTimeout: val })}
          min={0}
          max={60000}
          step={1000}
          description="Auto-close timeout in milliseconds"
        />

        <ConfigToggle
          label="Click-Through Popups"
          value={clickthroughPopups}
          onChange={(val) => setRaw({ clickthroughPopups: val })}
          description="Popups don't block clicks on other windows"
        />

        <ConfigSlider
          label="Moving Popup Chance"
          value={movingChance}
          onChange={(val) => setRaw({ movingChance: val })}
          min={0}
          max={100}
          description="Percentage chance for moving popups"
        />

        <ConfigSlider
          label="Moving Speed"
          value={movingSpeed}
          onChange={(val) => setRaw({ movingSpeed: val })}
          min={1}
          max={100}
          description="Speed of moving popups"
        />
      </SimpleGrid>

      <Text size="sm" c="dimmed" mt="md">
        Disabled Monitors: {disabledMonitors || "None"}
      </Text>
    </SectionCard>
  );
}
