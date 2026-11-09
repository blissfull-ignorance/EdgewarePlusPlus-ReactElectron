import { SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useSettingsStore } from "../../../../stores";
import { ConfigDropdown, ConfigField } from "../../../Config";
import { SectionCard } from "../../../SectionCard";

export function StartPanel() {
  const setRaw = useSettingsStore((state) => state.setRaw);
  const packPath = useSettingsStore((state) => state.packPath);
  const themeType = useSettingsStore((state) => state.themeType);
  const globalPanicButton = useSettingsStore((state) => state.globalPanicButton);
  const lkCorner = useSettingsStore((state) => state.lkCorner);

  const themeData = [
    { label: "Original", value: "Original" },
    { label: "Dark", value: "Dark" },
    { label: "The One", value: "The One" },
    { label: "Ransom", value: "Ransom" },
    { label: "Goth", value: "Goth" },
    { label: "Bimbo", value: "Bimbo" },
  ];

  const cornerData = [
    { label: "Random", value: "0" },
    { label: "Top Right", value: "1" },
    { label: "Top Left", value: "2" },
    { label: "Bottom Left", value: "3" },
    { label: "Bottom Right", value: "4" },
  ];

  return (
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
          description="Hotkey to panic (close) the application"
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
  );
}
