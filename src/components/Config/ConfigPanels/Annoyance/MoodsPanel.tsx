import { Checkbox, CheckboxGroup, Group, Stack, Text } from "@mantine/core";
import { IconMoodSmile } from "@tabler/icons-react";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

interface Mood {
  name: string;
  active: boolean;
}

// Moods derive from pack data; the list is populated from the active pack.
const availableMoods: Mood[] = [];

export function MoodsPanel() {
  const activeMoods = availableMoods.filter((m) => m.active).map((m) => m.name);
  const setRaw = useSettingsStore((s) => s.setRaw);

  return (
    <SectionCard
      icon={<IconMoodSmile size={16} />}
      title="Active Moods"
      description="Controls which pack content is available."
    >
      {availableMoods.length === 0 ? (
        <Group justify="center" align="center" gap="lg" wrap="wrap" style={{ padding: "20px 0" }}>
          <IconMoodSmile size={36} stroke={1.3} style={{ color: "var(--mantine-color-dark-3)" }} />
          <Stack gap={2} align="flex-start">
            <Text fw={600}>No moods available</Text>
            <Text size="sm" c="dimmed">
              Moods are defined by the active pack. Nothing to toggle for now.
            </Text>
          </Stack>
        </Group>
      ) : (
        <CheckboxGroup
          label="Select active moods (controls available content)"
          value={activeMoods}
          onChange={(values) => {
            const allNames = availableMoods.map((m) => m.name);
            const newActive = values as string[];
            allNames.forEach((name) => {
              const isActive = newActive.includes(name);
              setRaw({ [`mood_${name}`]: isActive ? 1 : 0 });
            });
          }}
        >
          {availableMoods.map((mood) => (
            <Checkbox key={mood.name} value={mood.name} label={mood.name} disabled={!mood.active} />
          ))}
        </CheckboxGroup>
      )}

      <Text size="xs" c="dimmed" mt="md">
        Active moods determine which pack content (images, audio, videos) is available for popups.
      </Text>
    </SectionCard>
  );
}
