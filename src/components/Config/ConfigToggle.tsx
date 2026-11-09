import { Badge, Checkbox, Group } from "@mantine/core";
import { IconAlertTriangle, IconLock } from "@tabler/icons-react";
import { ConfigFieldLabel } from "./ConfigFieldLabel";

interface ConfigToggleProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
  blocked?: boolean;
}

export function ConfigToggle({
  label,
  value,
  onChange,
  description,
  disabled,
  danger,
  blocked,
}: ConfigToggleProps) {
  const checked = value === 1;

  return (
    <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked ? 1 : 0)}
        disabled={disabled || blocked}
        style={{ flex: 1, minWidth: 0 }}
        label={<ConfigFieldLabel label={label} description={description} />}
      />
      {danger ? (
        <Badge
          variant="light"
          color="red"
          size="sm"
          fw={700}
          leftSection={<IconAlertTriangle size={12} strokeWidth={2.5} />}
        >
          DANGER
        </Badge>
      ) : null}
      {blocked ? (
        <Badge
          variant="light"
          color="gray"
          size="sm"
          fw={600}
          leftSection={<IconLock size={12} />}
        >
          BLOCKED
        </Badge>
      ) : null}
    </Group>
  );
}
