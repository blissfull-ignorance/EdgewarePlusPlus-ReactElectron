import { Alert, List, Text } from "@mantine/core";
import type { ValidationIssue } from "../../utils/zodValidation";

interface ValidationErrorsProps {
  errors: ValidationIssue[];
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <Alert color="yellow" variant="light" mb="md" data-testid="validation-errors">
      <Text fw={700} mb="sm">
        Configuration Warnings
      </Text>
      <List spacing="xs" size="sm">
        {errors.map((err, index) => (
          <List.Item key={index}>
            <Text component="span" fw={500}>{err.key}:</Text>{" "}
            <Text component="span" c="dimmed">{err.message}</Text>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
