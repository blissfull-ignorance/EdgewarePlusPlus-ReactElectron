import { Stack, Tabs, Text, Title } from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconBulb,
  IconDevices,
  IconSettings,
  IconSkull,
  type Icon,
} from "@tabler/icons-react";
import { ErrorBoundary } from "../ErrorBoundary";
import { GeneralPanel } from "./ConfigPanels/General/GeneralPanel";
import { AnnoyancePanel } from "./ConfigPanels/Annoyance/AnnoyancePanel";
import { ModesPanel } from "./ConfigPanels/Modes/ModesPanel";
import { CorruptionPanel } from "./ConfigPanels/Corruption/CorruptionPanel";
import { TroubleshootingPanel } from "./ConfigPanels/Troubleshooting/TroubleshootingPanel";
import { ValidationErrors } from "./ValidationErrors";
import { useSettingsStore } from "../../stores";

const CONFIG_TABS: { value: string; label: string; icon: Icon; description: string }[] = [
  {
    value: "general",
    label: "General",
    icon: IconSettings,
    description: "Pack selection, appearance and startup behaviour.",
  },
  {
    value: "annoyance",
    label: "Annoyance / Runtime",
    icon: IconActivityHeartbeat,
    description: "Popup chances, timing, wallpaper and runtime behaviour.",
  },
  {
    value: "modes",
    label: "Modes",
    icon: IconDevices,
    description: "Popup rendering, mitosis and hibernate modes.",
  },
  {
    value: "corruption",
    label: "Corruption",
    icon: IconSkull,
    description: "Guided mode driven by pack level transitions.",
  },
  {
    value: "troubleshooting",
    label: "Troubleshooting",
    icon: IconBulb,
    description: "Diagnostics and developer switches.",
  },
];

export interface ConfigPageProps {
  tab?: string;
  onTabChange?: (tab: string) => void;
  generalTab?: string;
  onGeneralTabChange?: (tab: string) => void;
}

export function ConfigPage({
  tab = "general",
  onTabChange,
  generalTab = "start",
  onGeneralTabChange,
}: ConfigPageProps) {
  const validationErrors = useSettingsStore((s) => s.validationErrors);
  const active = CONFIG_TABS.find((t) => t.value === tab) ?? CONFIG_TABS[0];

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={1} data-testid="config-title">
          Edgeware++ Configuration
        </Title>
        <Text size="sm" c="dimmed">
          {active.description}
        </Text>
      </Stack>

      {validationErrors.length > 0 ? <ValidationErrors errors={validationErrors} /> : null}

      <Tabs value={tab} onChange={(value) => onTabChange?.(value ?? tab)}>
        <Tabs.List mb="md">
          {CONFIG_TABS.map(({ value, label, icon: TabIcon }) => (
            <Tabs.Tab key={value} value={value} leftSection={<TabIcon size={15} />}>
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="general" pt={0}>
          <ErrorBoundary fallbackTitle="General Settings Error" fallbackMessage="Unable to load general settings.">
            <GeneralPanel tab={generalTab} onTabChange={onGeneralTabChange} />
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="annoyance" pt={0}>
          <ErrorBoundary fallbackTitle="Annoyance Settings Error" fallbackMessage="Unable to load annoyance settings.">
            <AnnoyancePanel />
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="modes" pt={0}>
          <ErrorBoundary fallbackTitle="Modes Settings Error" fallbackMessage="Unable to load modes settings.">
            <ModesPanel />
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="corruption" pt={0}>
          <ErrorBoundary fallbackTitle="Corruption Settings Error" fallbackMessage="Unable to load corruption settings.">
            <CorruptionPanel />
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel value="troubleshooting" pt={0}>
          <ErrorBoundary fallbackTitle="Troubleshooting Settings Error" fallbackMessage="Unable to load troubleshooting settings.">
            <TroubleshootingPanel />
          </ErrorBoundary>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
