import { useId } from "react";
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
  const inputId = useId();
  return (
    <Stack gap="xs">
      <ConfigFieldLabel label={label} description={description} htmlFor={inputId} />
      <TextInput
        id={inputId}
        aria-label={label}
        value={value.toString()}
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        disabled={disabled}
      />
    </Stack>
  );
}
