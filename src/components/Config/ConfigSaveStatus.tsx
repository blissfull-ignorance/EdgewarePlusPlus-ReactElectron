import { Badge, Group, Text } from "@mantine/core";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ConfigSaveStatusProps {
  status: SaveStatus;
  errorMessage?: string;
}

export function ConfigSaveStatus({ status, errorMessage }: ConfigSaveStatusProps) {
  if (status === "idle") return null;

  return (
    <Group gap="xs" align="center">
      {status === "saving" && (
        <Badge variant="light" color="blue" size="sm" data-testid="save-status-saving">
          Saving...
        </Badge>
      )}
      {status === "saved" && (
        <Badge variant="light" color="teal" size="sm" data-testid="save-status-saved">
          Saved
        </Badge>
      )}
      {status === "error" && (
        <>
          <Badge variant="light" color="red" size="sm" data-testid="save-status-error">
            Save Failed
          </Badge>
          {errorMessage && (
            <Text size="xs" c="red" data-testid="save-status-error-message" style={{ maxWidth: 260 }} truncate>
              {errorMessage}
            </Text>
          )}
        </>
      )}
    </Group>
  );
}
