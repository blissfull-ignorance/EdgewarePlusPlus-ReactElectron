import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

interface SpawnWarningModalProps {
  opened: boolean;
  issues: string[];
  onProceed: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

/**
 * Shown on Start (outside corruption mode) when the current settings would
 * keep popups from appearing — a leftover high spawn delay from a pack
 * session, every chance at zero, an instant auto-close. Names the culprits
 * instead of letting the session look broken.
 */
export function SpawnWarningModal({
  opened,
  issues,
  onProceed,
  onOpenSettings,
  onClose,
}: SpawnWarningModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Popups may not appear"
      size="sm"
      centered
      closeButtonProps={{ "aria-label": "Close spawn warning" }}
    >
      <Stack gap="md" data-testid="spawn-warning-modal">
        {issues.map((issue) => (
          <Group key={issue} gap="sm" align="flex-start" wrap="nowrap">
            <IconAlertTriangle size={18} color="var(--mantine-color-orange-5)" style={{ flexShrink: 0, marginTop: 2 }} />
            <Text size="sm">{issue}</Text>
          </Group>
        ))}
        <Group justify="right" gap="sm">
          <Button size="sm" variant="light" onClick={onOpenSettings} data-testid="spawn-warning-settings">
            Open settings
          </Button>
          <Button size="sm" onClick={onProceed} data-testid="spawn-warning-start">
            Start anyway
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
