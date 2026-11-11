import { Text } from "@mantine/core";

interface ConfigFieldLabelProps {
  label: string;
  description?: string;
  /** When set, the caption becomes a <label> bound to the input with this id. */
  htmlFor?: string;
}

export function ConfigFieldLabel({ label, description, htmlFor }: ConfigFieldLabelProps) {
  const caption = htmlFor ? (
    <Text
      component="label"
      htmlFor={htmlFor}
      size="sm"
      fw={600}
      style={{ overflowWrap: "anywhere" }}
    >
      {label}
    </Text>
  ) : (
    <Text size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
      {label}
    </Text>
  );
  return (
    <div>
      {caption}
      {description ? (
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
      ) : null}
    </div>
  );
}
