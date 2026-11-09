import { useEffect, useState } from "react";
import { ActionIcon, Group, Loader, Select, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolderOpen, IconPackage, IconPackageOff, IconRefresh } from "@tabler/icons-react";
import { usePackDiscovery } from "../../hooks/usePackDiscovery";
import { SectionCard } from "../SectionCard";
import type { PackListing } from "../../types/pack";

interface PackListProps {
  packs: PackListing[];
  currentPackPath?: string | null;
  onSelectPack: (path: string) => void | Promise<void>;
  onOpenLibrary?: () => void;
}

export function PackList({ packs, currentPackPath, onSelectPack, onOpenLibrary }: PackListProps) {
  const [selectedPack, setSelectedPack] = useState<string>(currentPackPath || "");
  const isLoading = usePackDiscovery((s) => s.isLoading);
  const refreshPacks = usePackDiscovery((s) => s.refreshPacks);

  useEffect(() => {
    setSelectedPack(currentPackPath || "");
  }, [currentPackPath]);

  const packOptions = packs.map((pack) => ({
    label: `${pack.name} (v${pack.version || "unknown"})`,
    value: pack.path,
  }));

  const handleSelect = (path: string | null) => {
    if (path) {
      setSelectedPack(path);
      void Promise.resolve(onSelectPack(path));
    }
  };

  return (
    <SectionCard
      icon={<IconPackage size={16} />}
      title="Pack Switching"
      description="Select which pack's media and settings Edgeware++ uses."
      right={
        <Group gap="xs">
          {onOpenLibrary ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onOpenLibrary}
              aria-label="Open pack library folder"
              title="Open pack library folder"
              data-testid="pack-open-library"
            >
              <IconFolderOpen size={17} />
            </ActionIcon>
          ) : null}
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => void refreshPacks()}
            aria-label="Refresh pack list"
            title="Refresh pack list"
            data-testid="pack-refresh"
          >
            <IconRefresh size={17} />
          </ActionIcon>
        </Group>
      }
    >
      {isLoading ? (
        <Group justify="center" gap="sm" style={{ padding: "18px 0" }}>
          <Loader size="sm" color="blue" />
          <Text size="sm" c="dimmed">
            Scanning pack library…
          </Text>
        </Group>
      ) : packs.length === 0 ? (
        <Group
          justify="center"
          align="center"
          gap="md"
          wrap="wrap"
          style={{ padding: "18px 0" }}
          data-testid="packs-empty"
        >
          <IconPackageOff size={34} stroke={1.3} style={{ color: "var(--mantine-color-dark-3)" }} />
          <Stack gap={2} align="flex-start">
            <Text size="sm" fw={700}>
              No Packs Found
            </Text>
            <Text size="xs" c="dimmed">
              The pack library is empty — drop a .zip above or import one from disk.
            </Text>
          </Stack>
        </Group>
      ) : (
        <Stack gap="sm">
          <Select
            label="Available Packs"
            placeholder="Select a pack to switch to"
            value={selectedPack}
            onChange={(val) => handleSelect(val)}
            data={packOptions}
            searchable
          />

          {currentPackPath ? (
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                Currently active:
              </Text>
              <Tooltip
                label={currentPackPath}
                position="bottom"
                multiline
                styles={{ tooltip: { maxWidth: 480, whiteSpace: "normal" } }}
              >
                <Text
                  size="xs"
                  fw={600}
                  truncate
                  data-testid="pack-active-path"
                  style={{ maxWidth: "100%" }}
                >
                  {currentPackPath}
                </Text>
              </Tooltip>
            </Group>
          ) : null}

          <Text size="xs" c="dimmed">
            Switching packs applies that pack's media and settings on the next start.
          </Text>
        </Stack>
      )}
    </SectionCard>
  );
}
