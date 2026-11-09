import { SimpleGrid, Stack } from "@mantine/core";
import { IconPhoto, IconMovie } from "@tabler/icons-react";
import { ConfigSlider, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function PopupTypesPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const popupMod = useSettingsStore((s) => s.popupMod);
  const audioMod = useSettingsStore((s) => s.audioMod);
  const vidMod = useSettingsStore((s) => s.vidMod);
  const webMod = useSettingsStore((s) => s.webMod);
  const promptMod = useSettingsStore((s) => s.promptMod);
  const capPopChance = useSettingsStore((s) => s.capPopChance);
  const subliminalsChance = useSettingsStore((s) => s.subliminalsChance);
  const denialChance = useSettingsStore((s) => s.denialChance);
  const notificationChance = useSettingsStore((s) => s.notificationChance);
  const videoVolume = useSettingsStore((s) => s.videoVolume);
  const videoLoopInf = useSettingsStore((s) => s.videoLoopInf);
  const videoLoopCount = useSettingsStore((s) => s.videoLoopCount);

  return (
    <Stack gap="lg">
    <SectionCard
      icon={<IconPhoto size={16} />}
      title="Popup Types - Chance Settings"
      description="Share of each popup type in the rotation."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigSlider
          label="Image Popup Chance"
          value={popupMod}
          onChange={(val) => setRaw({ popupMod: val })}
          min={0}
          max={100}
          description="Percentage chance for image popups"
        />

        <ConfigSlider
          label="Audio Popup Chance"
          value={audioMod}
          onChange={(val) => setRaw({ audioMod: val })}
          min={0}
          max={100}
          description="Percentage chance for audio popups"
        />

        <ConfigSlider
          label="Video Popup Chance"
          value={vidMod}
          onChange={(val) => setRaw({ vidMod: val })}
          min={0}
          max={100}
          description="Percentage chance for video popups"
        />

        <ConfigSlider
          label="Web Popup Chance"
          value={webMod}
          onChange={(val) => setRaw({ webMod: val })}
          min={0}
          max={100}
          description="Percentage chance for web popups"
        />

        <ConfigSlider
          label="Prompt Popup Chance"
          value={promptMod}
          onChange={(val) => setRaw({ promptMod: val })}
          min={0}
          max={100}
          description="Percentage chance for prompt popups"
        />

        <ConfigSlider
          label="Subliminal Chance"
          value={capPopChance}
          onChange={(val) => setRaw({ capPopChance: val })}
          min={0}
          max={100}
          description="Percentage chance for subliminal popups"
        />

        <ConfigSlider
          label="Hypno/Hypnosis Chance"
          value={subliminalsChance}
          onChange={(val) => setRaw({ subliminalsChance: val })}
          min={0}
          max={100}
          description="Percentage chance that a spiral GIF overlays an image/video popup"
        />

        <ConfigSlider
          label="Denial Chance"
          value={denialChance}
          onChange={(val) => setRaw({ denialChance: val })}
          min={0}
          max={100}
          description="Percentage chance for denial filters"
        />

        <ConfigSlider
          label="Notification Chance"
          value={notificationChance}
          onChange={(val) => setRaw({ notificationChance: val })}
          min={0}
          max={100}
          description="Percentage chance for system notifications"
        />
      </SimpleGrid>
    </SectionCard>

      <SectionCard
        icon={<IconMovie size={16} />}
        title="Video Loop"
        description="How often video popups replay before closing."
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
          <ConfigSlider
            label="Video Volume"
            value={videoVolume}
            onChange={(val) => setRaw({ videoVolume: val })}
            min={0}
            max={100}
            description="Playback volume for video popups"
          />

          <ConfigToggle
            label="Loop Infinitely"
            value={videoLoopInf}
            onChange={(val) => setRaw({ videoLoopInf: val })}
            description="Play videos on repeat until the popup closes another way"
          />

          <ConfigSlider
            label="Play Count"
            value={videoLoopCount}
            onChange={(val) => setRaw({ videoLoopCount: Math.max(1, val) })}
            min={1}
            max={10}
            disabled={videoLoopInf === 1}
            description="Times the video plays before the popup closes (used when infinite looping is off)"
          />
        </SimpleGrid>
      </SectionCard>
    </Stack>
  );
}
