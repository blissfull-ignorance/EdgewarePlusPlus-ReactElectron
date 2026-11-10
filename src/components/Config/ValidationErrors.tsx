import { Alert, List, Text } from "@mantine/core";
import { useMemo } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { collectSettingDangers } from "../../features/corruption/dangerFlags";
import type { ValidationIssue } from "../../utils/zodValidation";

interface ValidationErrorsProps {
  errors: ValidationIssue[];
}

/**
 * Live configuration warnings: schema issues in the loaded file plus the
 * legacy danger flags that the current values actually trigger. Nothing is
 * listed unless it is active right now.
 */
export function ValidationErrors({ errors }: ValidationErrorsProps) {
  const settings = useSettingsStore();

  const items = useMemo(() => {
    const dangers = collectSettingDangers(
      settings as unknown as Record<string, unknown>
    ).map((d) => ({ key: d.key, message: d.message }));
    const dangerKeys = new Set(dangers.map((d) => d.key));
    const schemaIssues = (errors ?? []).filter((e) => !dangerKeys.has(e.key));
    return [...dangers, ...schemaIssues];
  }, [settings, errors]);

  if (items.length === 0) return null;

  return (
    <Alert color="yellow" variant="light" mb="md" data-testid="validation-errors">
      <Text fw={700} mb="sm">
        Active Configuration Warnings
      </Text>
      <List spacing="xs" size="sm">
        {items.map((err, index) => (
          <List.Item key={`${err.key}-${index}`}>
            <Text component="span" fw={500}>{err.key}:</Text>{" "}
            <Text component="span" c="dimmed">{err.message}</Text>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
