import { Select, Stack } from "@mantine/core";
import { useId } from "react";
import { ConfigFieldLabel } from "./ConfigFieldLabel";

interface ConfigDropdownProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  data: { label: string; value: string }[];
  description?: string;
  disabled?: boolean;
  testId?: string;
}

export function ConfigDropdown({
  label,
  value,
  onChange,
  data,
  description,
  disabled,
  testId,
}: ConfigDropdownProps) {
  const inputId = useId();
  return (
    <Stack gap="xs">
      <ConfigFieldLabel label={label} description={description} htmlFor={inputId} />
      <Select
        id={inputId}
        aria-label={label}
        value={value.toString()}
        onChange={(val) => onChange(val !== null ? val : "")}
        data={data}
        disabled={disabled}
        data-testid={testId}
      />
    </Stack>
  );
}
