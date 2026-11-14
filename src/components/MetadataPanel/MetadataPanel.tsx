import { Grid, Group, Badge, Button, Text, Stack, Tooltip } from "@mantine/core";
import {
  IconActivityHeartbeat,
  IconFolderOpen,
  IconMoonStars,
  IconPackage,
  IconPackageOff,
  IconSkull,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { useCorruptionStore } from "../../stores/corruptionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePackDiscovery } from "../../hooks/usePackDiscovery";
import { lastSegment } from "../../utils/packPath";
import { SectionCard } from "../SectionCard";

/** Live "1m 23s" countdown to a scheduled instant; "—" when nothing pending. */
function useCountdownText(target: number | null): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (target === null) return "—";
  const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function MetadataPanel({ onOpenPackManager }: { onOpenPackManager?: () => void }) {
  const popupsCount = useAppStore((s) => s.popupsCount);
  const isRunning = useAppStore((s) => s.isRunning);
  const corruptionLevels = useCorruptionStore((s) => s.levels);
  const maxLevel = Math.max(0, ...Object.keys(corruptionLevels).map(Number));
  const hibernateActive = useAppStore((s) => s.hibernateActive);
  const hibernateNextBurst = useAppStore((s) => s.hibernateNextBurst);
  const hibernateCountdown = useCountdownText(hibernateNextBurst);
  const currentLevel = useCorruptionStore((s) => s.currentLevel);
  const activeMoods = useCorruptionStore((s) => s.activeMoods);
  const driverType = useCorruptionStore((s) => s.driverType);
  const nextLevelTime = useCorruptionStore((s) => s.nextLevelTime);
  const corruptionMode = useSettingsStore((s) => s.corruptionMode);
  const packPath = useSettingsStore((s) => s.packPath);
  const hibernateMode = useSettingsStore((s) => s.hibernateMode);
  const mitosisMode = useSettingsStore((s) => s.mitosisMode);
  const mitosisStrength = useSettingsStore((s) => s.mitosisStrength);
  const packs = usePackDiscovery((s) => s.packs);

  const matchedPack = packPath ? packs.find((p) => p.path === packPath) : undefined;
  const packName = matchedPack?.name ?? (packPath ? lastSegment(packPath) : null);

  const formatNextLevelTime = (time: number | null): string => {
    if (!time) return "—";
    const remaining = time - Date.now();
    if (remaining <= 0) return "Due";
    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const hibernateState = hibernateMode ? (hibernateActive ? "Active" : "Enabled, Idle") : "Disabled";
  const hibernateColor = hibernateMode ? (hibernateActive ? "teal" : "blue") : "gray";

  return (
    <div data-testid="metadata-panel">
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <SectionCard
            icon={<IconActivityHeartbeat size={16} />}
            title="Status"
            right={
              <Badge
                data-testid="running-state"
                size="lg"
                variant="light"
                color={isRunning ? "teal" : "gray"}
                fw={600}
                leftSection={
                  <span
                    className={`ewpp-status-dot${isRunning ? " ewpp-status-dot-pulse" : ""}`}
                    style={{
                      backgroundColor: isRunning
                        ? "var(--mantine-color-teal-5)"
                        : "var(--mantine-color-dark-3)",
                    }}
                  />
                }
              >
                {isRunning ? "Running" : "Stopped"}
              </Badge>
            }
          >
            <Stack gap="sm">
              <div>
                <Text
                  data-testid="popup-count"
                  fw={800}
                  style={{ fontSize: "1.75rem", lineHeight: 1.15 }}
                >
                  <Text component="span" size="md" fw={500} c="dimmed">
                    Active:{" "}
                  </Text>
                  {popupsCount}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  active popups
                </Text>
              </div>
              <Text size="sm" c="dimmed">
                Popups spawn on a timer while running. Use the Start / Stop button in the header
                to control the main loop.
              </Text>
            </Stack>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <SectionCard
            icon={<IconPackage size={16} />}
            title="Pack"
            right={
              packPath ? <Badge variant="light" color="teal" size="sm">Loaded</Badge> : undefined
            }
          >
            {packPath ? (
              <Stack gap="xs">
                <Group gap="sm" align="center" wrap="nowrap">
                  <Text size="md" fw={700} data-testid="pack-info" style={{ minWidth: 0 }} truncate>
                    {packName}
                  </Text>
                  {matchedPack?.version ? (
                    <Badge variant="subtle" size="xs" fw={500}>
                      v{matchedPack.version}
                    </Badge>
                  ) : null}
                </Group>
                {matchedPack?.creator ? (
                  <Text size="sm" c="dimmed">
                    Created by {matchedPack.creator}
                  </Text>
                ) : null}
                <Tooltip
                  label={packPath}
                  position="bottom"
                  multiline
                  styles={{ tooltip: { maxWidth: 480, whiteSpace: "normal" } }}
                >
                  <Text
                    size="xs"
                    c="dimmed"
                    truncate
                    data-testid="pack-path"
                    style={{ maxWidth: "100%" }}
                  >
                    {packPath}
                  </Text>
                </Tooltip>
              </Stack>
            ) : (
              <Group data-testid="pack-empty-state" justify="center" align="center" gap="lg" wrap="wrap" style={{ padding: "28px 0" }}>
                <IconPackageOff size={44} stroke={1.2} style={{ color: "var(--mantine-color-dark-3)" }} />
                <Stack gap="xs" align="flex-start">
                  <Text fw={700}>No pack loaded</Text>
                  <Text size="sm" c="dimmed">
                    Edgeware++ has nothing to throw until a pack is loaded.
                  </Text>
                  {onOpenPackManager ? (
                    <Button
                      leftSection={<IconFolderOpen size={15} />}
                      onClick={onOpenPackManager}
                      fw={600}
                      data-testid="open-pack-manager"
                      mt="xs"
                    >
                      Choose a pack
                    </Button>
                  ) : null}
                </Stack>
              </Group>
            )}
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <SectionCard icon={<IconSkull size={16} />} title="Corruption Mode">
            <Stack gap="sm">
              <Group gap="sm" align="center">
                <Badge variant="light" color={corruptionMode ? "red" : "gray"} size="sm">
                  {corruptionMode ? "Active" : "Inactive"}
                </Badge>
                <Text size="sm" data-testid="corruption-level">
                  Level: {currentLevel}
                  {maxLevel > 0 ? ` / ${maxLevel}` : ""}
                </Text>
              </Group>
              {isRunning && maxLevel > 0 && currentLevel < maxLevel ? (
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    data-testid="corruption-skip"
                    onClick={() => void window.api?.scripting.advanceLevel().catch(() => undefined)}
                  >
                    Skip to level {currentLevel + 1}
                  </Button>
                </Group>
              ) : null}
              {corruptionMode ? (
                <>
                  <Text size="sm" c="dimmed" data-testid="driver-type">
                    Driver: {driverType}
                  </Text>
                  <Text size="sm" c="dimmed" data-testid="next-level-time">
                    Next transition: {formatNextLevelTime(nextLevelTime)}
                  </Text>
                  {activeMoods.length > 0 ? (
                    <Group gap="xs" wrap="wrap">
                      {activeMoods.map((mood) => (
                        <Badge key={mood} size="xs" variant="light" data-testid="active-mood">
                          {mood}
                        </Badge>
                      ))}
                    </Group>
                  ) : null}
                </>
              ) : null}
            </Stack>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <SectionCard icon={<IconMoonStars size={16} />} title="Hibernate">
            <Group gap="sm" align="center">
              <Badge variant="light" color={hibernateColor} size="sm" data-testid="hibernate-state">
                {hibernateState}
              </Badge>
              <Text size="sm" c="dimmed" data-testid="hibernate-countdown">
                Countdown: {hibernateActive ? "In progress" : hibernateCountdown}
              </Text>
            </Group>
          </SectionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <SectionCard icon={<IconSparkles size={16} />} title="Mitosis">
            <Group gap="sm" align="center" data-testid="mitosis-indicator">
              <Badge variant="light" color={mitosisMode ? "orange" : "gray"} size="sm">
                {mitosisMode ? `Active (strength: ${mitosisStrength})` : "Inactive"}
              </Badge>
            </Group>
          </SectionCard>
        </Grid.Col>
      </Grid>
    </div>
  );
}
