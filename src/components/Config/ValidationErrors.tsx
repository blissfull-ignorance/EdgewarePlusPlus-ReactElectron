import { Alert, List, Text } from "@mantine/core";
import { useMemo } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { collectSettingDangers } from "../../features/corruption/dangerFlags";
import { validateSettings } from "../../utils/zodValidation";

/**
 * Live configuration warnings: the legacy danger flags and schema issues
 * computed from the values currently in the store. Nothing is listed unless
 * it is active right now, and correcting a value clears its line.
 */
export function ValidationErrors() {
  const settings = useSettingsStore();

  const items = useMemo(() => {
    const record = settings as unknown as Record<string, unknown>;
    const dangers = collectSettingDangers(record);
    const dangerKeys = new Set(dangers.map((d) => d.key));
    const schemaIssues = validateSettings(record).filter((e) => !dangerKeys.has(e.key));
    return [...dangers, ...schemaIssues];
  }, [settings]);

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
