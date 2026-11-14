import { useEffect, useState } from "react";
import { Badge, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconMoodSmile } from "@tabler/icons-react";
import { useCorruptionStore } from "../../../../stores/corruptionStore";
import { SectionCard } from "../../../SectionCard";

interface PackMood {
  name: string;
  mediaCount: number;
  captionCount: number;
}

/**
 * The active pack's mood catalogue. Moods are switched on and off by the
 * corruption progression (or a pack script); the panel reflects which ones
 * are currently unlocking pack content.
 */
export function MoodsPanel() {
  const [moods, setMoods] = useState<PackMood[]>([]);
  const activeMoods = useCorruptionStore((s) => s.activeMoods);

  useEffect(() => {
    let alive = true;
    void window.api?.pack
      .listMoods()
      .then((list) => {
        if (alive) setMoods(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const active = new Set(activeMoods);

  return (
    <SectionCard
      icon={<IconMoodSmile size={16} />}
      title="Pack Moods"
      description="Content pools unlocked by the corruption progression."
    >
      {moods.length === 0 ? (
        <Group justify="center" align="center" gap="lg" wrap="wrap" style={{ padding: "20px 0" }}>
          <IconMoodSmile size={36} stroke={1.3} style={{ color: "var(--mantine-color-dark-3)" }} />
          <Stack gap={2} align="flex-start">
            <Text fw={600}>No moods available</Text>
            <Text size="sm" c="dimmed">
              Moods are defined by the active pack. Nothing to show for now.
            </Text>
          </Stack>
        </Group>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" verticalSpacing="sm">
            {moods.map((mood) => {
              const isActive = active.has(mood.name);
              return (
                <Group
                  key={mood.name}
                  gap="xs"
                  wrap="nowrap"
                  justify="space-between"
                  data-testid={`mood-${mood.name}`}
                >
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>
                      {mood.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {mood.mediaCount} media · {mood.captionCount} captions
                    </Text>
                  </Stack>
                  <Badge size="xs" variant={isActive ? "filled" : "light"} color={isActive ? "teal" : "gray"}>
                    {isActive ? "Active" : "Locked"}
                  </Badge>
                </Group>
              );
            })}
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt="md">
            Active moods unlock their content for popups. This covers images,
            videos, audio, captions and links. Corruption levels and pack
            scripts switch moods on and off during a session.
          </Text>
        </>
      )}
    </SectionCard>
  );
}
