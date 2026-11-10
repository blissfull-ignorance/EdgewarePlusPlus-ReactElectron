import { Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconBulb } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { ConfigField, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function TroubleshootingPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const toggleHibSkip = useSettingsStore((s) => s.toggleHibSkip);
  const toggleMoodSet = useSettingsStore((s) => s.toggleMoodSet);
  const toggleInternet = useSettingsStore((s) => s.toggleInternet);
  const mpvSubprocess = useSettingsStore((s) => s.mpvSubprocess);
  const videoHardwareAcceleration = useSettingsStore((s) => s.videoHardwareAcceleration);
  const panicButton = useSettingsStore((s) => s.panicButton);

  return (
    <SectionCard
      icon={<IconBulb size={16} />}
      title="Troubleshooting"
      description="Diagnostics and developer switches."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Hibernate Skip (Tray)"
          value={toggleHibSkip}
          onChange={(val) => setRaw({ toggleHibSkip: val })}
          disabled
          description="Enable skip Hibernate via tray icon"
        />

        <ConfigToggle
          label="Mood Settings Toggle"
          value={toggleMoodSet}
          onChange={(val) => setRaw({ toggleMoodSet: val })}
          disabled
          description="Allow mood set toggling"
        />

        <ConfigToggle
          label="Internet (GitHub Check)"
          value={toggleInternet}
          onChange={(val) => setRaw({ toggleInternet: val })}
          disabled
          description="Enable GitHub version checks"
        />

        <ConfigToggle
          label="MPV Subprocess"
          value={mpvSubprocess}
          onChange={(val) => setRaw({ mpvSubprocess: val })}
          disabled
          description="Use MPV as separate process"
        />

        <ConfigToggle
          label="Video Hardware Acceleration"
          value={videoHardwareAcceleration}
          onChange={(val) => setRaw({ videoHardwareAcceleration: val })}
          description="Enable hardware video decoding"
        />

        <ConfigField
          label="Panic Button"
          value={panicButton}
          onChange={(val) => setRaw({ panicButton: val })}
          disabled
          description="Hotkey to panic (close) application"
        />
      </SimpleGrid>

      <LuaSelfTestCard />
    </SectionCard>
  );
}

/**
 * Runs the bundled edgeware_v0 API self-test in the main-process Lua VM: it
 * spawns visible popups and corruption transitions so the scripting surface
 * can be verified without shipping a test pack. Restarts the Lua session.
 */
function LuaSelfTestCard() {
  const [status, setStatus] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setStatus("running");
    setError(null);
    void window.api?.scripting
      .runSelfTest()
      .then((res) => {
        if (res.ok) {
          setStatus("passed");
        } else {
          setStatus("failed");
          setError(res.error ?? "Unknown Lua error");
        }
      })
      .catch((err: unknown) => {
        setStatus("failed");
        setError(String(err));
      });
  }, []);

  return (
    <Stack gap="xs" mt="md">
      <Group gap="md">
        <Button
          size="xs"
          variant="light"
          data-testid="run-lua-self-test"
          loading={status === "running"}
          onClick={run}
        >
          Run Lua API self-test
        </Button>
        {status === "passed" ? (
          <Text size="sm" c="teal" data-testid="lua-self-test-result">
            Self-test started — watch for popups and transitions.
          </Text>
        ) : null}
        {status === "failed" ? (
          <Text size="sm" c="red" data-testid="lua-self-test-result">
            Self-test failed: {error}
          </Text>
        ) : null}
      </Group>
      <Text size="xs" c="dimmed">
        Exercises every edgeware_v0 scripting function with visible popups, a
        notification and two corruption transitions. Start the runtime first to
        see the transitions; this restarts the pack script session.
      </Text>
    </Stack>
  );
}
