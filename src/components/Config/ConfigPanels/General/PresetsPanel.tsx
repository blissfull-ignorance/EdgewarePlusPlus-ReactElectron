import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { IconDeviceFloppy, IconFileStack } from "@tabler/icons-react";
import { SectionCard } from "../../../SectionCard";

// FUTUREWORK: preset save/load (profile persistence) is not wired yet —
// keep the affordances disabled until the preset store exists.
const availablePresets: { name: string; path: string }[] = [];

export function PresetsPanel() {
  return (
    <SectionCard
      icon={<IconFileStack size={16} />}
      title="Preset Management"
      description="Save the current settings as a named profile and load it back any time."
    >
      <Group justify="center" align="center" gap="lg" wrap="wrap" style={{ padding: "20px 0" }}>
        <IconFileStack size={36} stroke={1.3} style={{ color: "var(--mantine-color-dark-3)" }} />
        <Stack gap="xs" align="flex-start">
          <Text fw={600}>No presets yet</Text>
          <Text size="sm" c="dimmed">
            Presets will let you save the current settings as reusable profiles.
          </Text>
          <Group gap="sm" mt="xs">
            <Button
              variant="light"
              leftSection={<IconDeviceFloppy size={15} />}
              disabled
              data-testid="save-preset-button"
            >
              Save Current Settings
            </Button>
            <Select
              label="Load Preset"
              placeholder="Select a preset"
              value=""
              onChange={() => {}}
              data={availablePresets.map((p) => ({ label: p.name, value: p.path }))}
              disabled
              w={200}
            />
          </Group>
        </Stack>
      </Group>
    </SectionCard>
  );
}
