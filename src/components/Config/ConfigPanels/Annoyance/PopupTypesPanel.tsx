import { SimpleGrid } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { ConfigSlider } from "../../../Config";
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

  return (
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
  );
}
