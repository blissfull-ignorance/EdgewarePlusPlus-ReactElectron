import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle, IconPackageOff } from "@tabler/icons-react";
import { useSettingsStore } from "../../../../stores";
import { usePackDiscovery } from "../../../../hooks/usePackDiscovery";
import { SectionCard } from "../../../SectionCard";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Tooltip
        label={value}
        position="bottom"
        multiline
        styles={{ tooltip: { maxWidth: 420, whiteSpace: "normal" } }}
      >
        <Text
          size="sm"
          fw={600}
          style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {value}
        </Text>
      </Tooltip>
    </Group>
  );
}

export function InfoPanel() {
  const packPath = useSettingsStore((s) => s.packPath);
  const packs = usePackDiscovery((s) => s.packs);
  const matchedPack = packPath ? packs.find((p) => p.path === packPath) : undefined;

  return (
    <SectionCard
      icon={<IconInfoCircle size={16} />}
      title="Pack Information"
      description="Metadata for the active pack."
    >
      {packPath ? (
        matchedPack ? (
          <Stack gap="sm">
            <InfoRow label="Name" value={matchedPack.name} />
            <InfoRow label="Version" value={matchedPack.version ? `v${matchedPack.version}` : "—"} />
            <InfoRow label="Creator" value={matchedPack.creator ?? "—"} />
            <InfoRow label="Path" value={packPath} />
          </Stack>
        ) : (
          <Stack gap="sm">
            <Group justify="space-between" gap="md" wrap="nowrap">
              <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                Path
              </Text>
              <Tooltip
                label={packPath}
                position="bottom"
                multiline
                styles={{ tooltip: { maxWidth: 420, whiteSpace: "normal" } }}
              >
                <Text
                  size="sm"
                  fw={600}
                  style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {packPath}
                </Text>
              </Tooltip>
            </Group>
            <Text size="sm" c="dimmed">
              This pack is not in the discovered library yet — refresh Pack Management to pick it
              up.
            </Text>
          </Stack>
        )
      ) : (
        <Group justify="center" align="center" gap="lg" wrap="wrap" style={{ padding: "20px 0" }}>
          <IconPackageOff size={36} stroke={1.3} style={{ color: "var(--mantine-color-dark-3)" }} />
          <Stack gap={2} align="flex-start">
            <Text fw={600}>No pack loaded</Text>
            <Text size="sm" c="dimmed">
              Choose a pack in Pack Management to see its metadata here.
            </Text>
          </Stack>
        </Group>
      )}
    </SectionCard>
  );
}
