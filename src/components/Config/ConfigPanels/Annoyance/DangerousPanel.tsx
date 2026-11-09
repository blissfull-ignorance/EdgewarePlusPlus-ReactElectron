import { SimpleGrid } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function DangerousPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const timerMode = useSettingsStore((s) => s.timerMode);
  const panicDisabled = useSettingsStore((s) => s.panicDisabled);
  const fill = useSettingsStore((s) => s.fill);
  const replace = useSettingsStore((s) => s.replace);
  const startOnLogon = useSettingsStore((s) => s.startOnLogon);
  const showDiscord = useSettingsStore((s) => s.showDiscord);

  return (
    <SectionCard
      tone="danger"
      icon={<IconAlertTriangle size={16} />}
      title="DANGEROUS SETTINGS"
      description="These options go deep. Keep most of them off."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Panic Lockout Mode"
          value={timerMode}
          onChange={(val) => setRaw({ timerMode: val })}
          danger
          description="Enable time-based panic lockout"
        />

        <ConfigToggle
          label="Panic Hotkey Disabled"
          value={panicDisabled}
          onChange={(val) => setRaw({ panicDisabled: val })}
          danger
          description="Disable panic hotkey (not recommended)"
        />

        <ConfigToggle
          label="Fill Drive Enabled"
          value={fill}
          onChange={() => {}}
          danger
          blocked
          disabled
          description="DANGEROUS: Fill drive with images (FEATURE DROPPED)"
        />

        <ConfigToggle
          label="Replace Images Enabled"
          value={replace}
          onChange={() => {}}
          danger
          blocked
          disabled
          description="EXTREME DANGER: Replace system images (FEATURE DROPPED)"
        />

        <ConfigToggle
          label="Launch on PC Startup"
          value={startOnLogon}
          onChange={(val) => setRaw({ startOnLogon: val })}
          danger
          description="Auto-start Edgeware on computer startup"
        />

        <ConfigToggle
          label="Show on Discord"
          value={showDiscord}
          onChange={(val) => setRaw({ showDiscord: val })}
          danger
          description="Display Rich Presence on Discord"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
