import { Text } from "@mantine/core";

interface ConfigFieldLabelProps {
  label: string;
  description?: string;
}

export function ConfigFieldLabel({ label, description }: ConfigFieldLabelProps) {
  return (
    <div>
      <Text size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
        {label}
      </Text>
      {description ? (
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
      ) : null}
    </div>
  );
}
