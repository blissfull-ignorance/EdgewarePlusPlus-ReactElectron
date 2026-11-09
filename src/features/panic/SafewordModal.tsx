/**
 * @file SafewordModal — panic prompt shown while a panic lockout is active.
 *
 * A panic attempt during the lockout window is blocked in the main process
 * and echoed to the renderer via `panic:blocked`; this modal collects the
 * safeword and hands it to `panic:unlock`, which completes the teardown on a
 * match and keeps the app running otherwise.
 */
import { useState } from "react";
import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";

export interface SafewordModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SafewordModal({ opened, onClose }: SafewordModalProps) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    void window.api?.panic.unlock(value).then((result) => {
      if (result && !result.ok) {
        setWrong(true);
      }
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Panic lockout"
      centered
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md" data-testid="safeword-modal">
        <Text size="sm" c="dimmed">
          Panic is locked. Enter your safeword to panic anyway.
        </Text>
        <TextInput
          data-testid="safeword-input"
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            setWrong(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          error={wrong ? "Wrong safeword" : undefined}
          autoFocus
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} data-testid="safeword-cancel">
            Cancel
          </Button>
          <Button color="red" onClick={submit} data-testid="safeword-submit">
            Panic
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
