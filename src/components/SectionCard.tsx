import type { CSSProperties, ReactNode } from "react";
import { Group, Paper, Text } from "@mantine/core";

interface SectionCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  right?: ReactNode;
  tone?: "default" | "danger";
  titleStyle?: CSSProperties;
  children?: ReactNode;
}

export function SectionCard({
  icon,
  title,
  description,
  right,
  tone = "default",
  titleStyle,
  children,
}: SectionCardProps) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="md"
      data-danger={tone === "danger" ? "true" : undefined}
      style={tone === "danger" ? { borderColor: "red" } : undefined}
    >
      <Group justify="space-between" align="flex-start" gap="sm" mb={children ? "md" : 0}>
        <Group gap="sm" align="center" wrap="wrap">
          {icon ? (
            <div
              className="ewpp-card-icon"
              style={
                tone === "danger"
                  ? {
                      color: "var(--mantine-color-red-4)",
                      backgroundColor: "rgba(220, 38, 38, 0.12)",
                    }
                  : undefined
              }
            >
              {icon}
            </div>
          ) : null}
          <div>
            <Text
              size="md"
              fw={700}
              data-danger-title={tone === "danger" ? "true" : undefined}
              style={tone === "danger" ? { color: "var(--mantine-color-red-5)" } : titleStyle}
            >
              {title}
            </Text>
            {description ? (
              <Text size="xs" c="dimmed" mt={2}>
                {description}
              </Text>
            ) : null}
          </div>
        </Group>
        {right}
      </Group>
      {children}
    </Paper>
  );
}
