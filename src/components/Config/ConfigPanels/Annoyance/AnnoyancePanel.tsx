import { Stack, Tabs, Text } from "@mantine/core";
import {
  IconAlertTriangle,
  IconDownload,
  IconMoodSmile,
  IconPhoto,
  IconTools,
  IconDeviceDesktop,
  type Icon,
} from "@tabler/icons-react";
import { PopupTypesPanel } from "./PopupTypesPanel";
import { PopupTweaksPanel } from "./PopupTweaksPanel";
import { WallpaperPanel } from "./WallpaperPanel";
import { MoodsPanel } from "./MoodsPanel";
import { BooruPanel } from "./BooruPanel";
import { DangerousPanel } from "./DangerousPanel";

const ANNOYANCE_TABS: { value: string; label: string; icon: Icon }[] = [
  { value: "popupTypes", label: "Popup Types", icon: IconPhoto },
  { value: "popupTweaks", label: "Popup Tweaks", icon: IconTools },
  { value: "wallpaper", label: "Wallpaper", icon: IconDeviceDesktop },
  { value: "moods", label: "Moods", icon: IconMoodSmile },
  { value: "booru", label: "Booru", icon: IconDownload },
  { value: "dangerous", label: "Dangerous", icon: IconAlertTriangle },
];

export interface AnnoyancePanelProps {
  tab?: string;
  onTabChange?: (tab: string) => void;
}

export function AnnoyancePanel({ tab = "popupTypes", onTabChange }: AnnoyancePanelProps) {
  return (
    <Stack gap="md">
      <Text size="lg" fw={700}>
        Annoyance / Runtime Settings
      </Text>

      <Tabs value={tab} onChange={(value) => onTabChange?.(value ?? tab)}>
        <Tabs.List mb="md">
          {ANNOYANCE_TABS.map(({ value, label, icon: TabIcon }) => (
            <Tabs.Tab key={value} value={value} leftSection={<TabIcon size={15} />}>
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="popupTypes" pt={0}>
          <PopupTypesPanel />
        </Tabs.Panel>

        <Tabs.Panel value="popupTweaks" pt={0}>
          <PopupTweaksPanel />
        </Tabs.Panel>

        <Tabs.Panel value="wallpaper" pt={0}>
          <WallpaperPanel />
        </Tabs.Panel>

        <Tabs.Panel value="moods" pt={0}>
          <MoodsPanel />
        </Tabs.Panel>

        <Tabs.Panel value="booru" pt={0}>
          <BooruPanel />
        </Tabs.Panel>

        <Tabs.Panel value="dangerous" pt={0}>
          <DangerousPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
