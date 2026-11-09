import { Select, Stack } from "@mantine/core";
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
  return (
    <Stack gap="xs">
      <ConfigFieldLabel label={label} description={description} />
      <Select
        value={value.toString()}
        onChange={(val) => onChange(val !== null ? val : "")}
        data={data}
        disabled={disabled}
        data-testid={testId}
      />
    </Stack>
  );
}
