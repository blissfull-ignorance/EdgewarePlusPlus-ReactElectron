import { SimpleGrid } from "@mantine/core";
import { IconBulb } from "@tabler/icons-react";
import { ConfigField, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function TroubleshootingPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const toggleHibSkip = useSettingsStore((s) => s.toggleHibSkip);
  const toggleMoodSet = useSettingsStore((s) => s.toggleMoodSet);
  const toggleInternet = useSettingsStore((s) => s.toggleInternet);
  const mpvSubprocess = useSettingsStore((s) => s.mpvSubprocess);
  const videoHardwareAcceleration = useSettingsStore((s) => s.videoHardwareAcceleration);
  const panicButton = useSettingsStore((s) => s.panicButton);

  return (
    <SectionCard
      icon={<IconBulb size={16} />}
      title="Troubleshooting"
      description="Diagnostics and developer switches."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Hibernate Skip (Tray)"
          value={toggleHibSkip}
          onChange={(val) => setRaw({ toggleHibSkip: val })}
          disabled
          description="Enable skip Hibernate via tray icon"
        />

        <ConfigToggle
          label="Mood Settings Toggle"
          value={toggleMoodSet}
          onChange={(val) => setRaw({ toggleMoodSet: val })}
          disabled
          description="Allow mood set toggling"
        />

        <ConfigToggle
          label="Internet (GitHub Check)"
          value={toggleInternet}
          onChange={(val) => setRaw({ toggleInternet: val })}
          disabled
          description="Enable GitHub version checks"
        />

        <ConfigToggle
          label="MPV Subprocess"
          value={mpvSubprocess}
          onChange={(val) => setRaw({ mpvSubprocess: val })}
          disabled
          description="Use MPV as separate process"
        />

        <ConfigToggle
          label="Video Hardware Acceleration"
          value={videoHardwareAcceleration}
          onChange={(val) => setRaw({ videoHardwareAcceleration: val })}
          description="Enable hardware video decoding"
        />

        <ConfigField
          label="Panic Button"
          value={panicButton}
          onChange={(val) => setRaw({ panicButton: val })}
          disabled
          description="Hotkey to panic (close) application"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
