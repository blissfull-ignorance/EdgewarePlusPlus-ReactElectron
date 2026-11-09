/**
 * @file CorruptionDangerModal — start-up confirmation for full-permission
 * corruption.
 *
 * When corruption mode runs with full permission, pack levels may change
 * dangerous settings. Before the runtime starts, the collected danger report
 * is shown here; the runtime only proceeds on explicit confirmation, matching
 * the legacy "Corruption Config Warning" gate.
 */
import { Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { DangerReport } from "./danger";

export interface CorruptionDangerModalProps {
  opened: boolean;
  report: DangerReport | null;
  onProceed: () => void;
  onCancel: () => void;
}

const LEVEL_COLOR: Record<string, string> = {
  EXTREME: "red",
  MAJOR: "orange",
  MEDIUM: "yellow",
  MINOR: "gray",
};

export function CorruptionDangerModal({
  opened,
  report,
  onProceed,
  onCancel,
}: CorruptionDangerModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Corruption Config Warning"
      centered
      size="lg"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md" data-testid="corruption-danger-modal">
        <Text size="sm">
          Corruption mode is running in full permission mode, meaning your pack can change
          Edgeware&apos;s settings. This pack changes{" "}
          <Text component="span" fw={700}>
            {report?.count ?? 0}
          </Text>{" "}
          setting(s) which may be dangerous:
        </Text>
        {report?.groups.map((group) => (
          <Stack key={group.level} gap={4} data-testid={`danger-group-${group.level}`}>
            <Badge color={LEVEL_COLOR[group.level]} fw={700}>
              {group.level}
            </Badge>
            <Stack gap={2}>
              {group.warnings.map((warning) => (
                <Text key={warning} size="sm">
                  • {warning}
                </Text>
              ))}
            </Stack>
          </Stack>
        ))}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel} data-testid="danger-cancel">
            Cancel
          </Button>
          <Button color="red" onClick={onProceed} data-testid="danger-proceed">
            Proceed
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
