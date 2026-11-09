import { Stack, TextInput } from "@mantine/core";
import { ConfigFieldLabel } from "./ConfigFieldLabel";

interface ConfigFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  description?: string;
  disabled?: boolean;
  type?: "text" | "number";
}

export function ConfigField({
  label,
  value,
  onChange,
  description,
  disabled,
  type = "text",
}: ConfigFieldProps) {
  return (
    <Stack gap="xs">
      <ConfigFieldLabel label={label} description={description} />
      <TextInput
        value={value.toString()}
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        disabled={disabled}
      />
    </Stack>
  );
}
