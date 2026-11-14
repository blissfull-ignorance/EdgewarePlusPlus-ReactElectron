import { Button, Group, Modal, Text } from "@mantine/core";

/**
 * Shared confirmation for deleting one pack media file. Deletion removes
 * the file from disk and clears its mood tags, so it always asks first.
 */
export function ConfirmFileDelete({
  file,
  opened,
  onClose,
  onConfirm,
}: {
  file: string | null;
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete file from pack" size="sm" centered>
      <Text size="sm" data-testid="confirm-file-delete-text">
        Delete <b>{file}</b> from the pack? The file is removed from disk and
        its mood tags are cleared. This cannot be undone.
      </Text>
      <Group justify="flex-end" gap="xs" mt="md">
        <Button size="xs" variant="subtle" onClick={onClose} data-testid="delete-file-cancel">
          Cancel
        </Button>
        <Button size="xs" color="red" onClick={onConfirm} data-testid="delete-file-confirm">
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
