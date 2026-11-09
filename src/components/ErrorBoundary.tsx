import { Component, type ReactNode, type ErrorInfo } from "react";
import { Paper, Text, Button, Stack, Group } from "@mantine/core";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { logger } from "../utils/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("ErrorBoundary caught an error:", error.message, errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            backgroundColor: "var(--mantine-color-dark-6)",
            borderColor: "var(--mantine-color-red-7)",
          }}
        >
          <Stack gap="sm">
            <Group gap="sm" align="center">
              <IconAlertTriangle size={18} color="var(--mantine-color-red-4)" />
              <Text fw={700} c="red" style={{ color: "var(--mantine-color-red-4)" }}>
                {this.props.fallbackTitle || "Something went wrong"}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {this.props.fallbackMessage || "An unexpected error occurred. This has been logged for debugging."}
            </Text>
            {this.state.error && (
              <Text size="xs" c="red" fw={500}>
                {this.state.error.message}
              </Text>
            )}
            <Button
              variant="outline"
              color="red"
              size="xs"
              onClick={this.handleReset}
              leftSection={<IconRefresh size={13} />}
            >
              Try Again
            </Button>
          </Stack>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
