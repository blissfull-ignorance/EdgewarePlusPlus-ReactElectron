import { useState, useCallback, useEffect } from "react";
import { Button, Group, Stack, Text, TextInput, Paper, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { useSettingsStore } from "../../stores/settingsStore";
import { levenshteinDistance } from "../../utils/leet";

export interface PromptDialogProps {
  /** Shown as the instruction title unless the pack defines its own promptCommand. */
  command?: string;
  /** The phrase the user must type back to close the dialog. */
  expectedAnswer: string;
  minLength?: number;
  maxLength?: number;
  onClose?: (success: boolean) => void;
}

interface PackPromptMeta {
  command: string | null;
  submit: string | null;
}

/**
 * The original prompt window used pack-defined strings: the header came from
 * `promptCommand` and the submit button from `promptSubmit`. We pull them from
 * the active pack index once and fall back to neutral text when unavailable
 * (mocked browser layer, pack without prompts).
 */
function usePackPromptMeta(): PackPromptMeta | null {
  const [meta, setMeta] = useState<PackPromptMeta | null>(null);

  useEffect(() => {
    let live = true;
    const fn = window.api?.pack?.loadIndex;
    if (typeof fn !== "function") return;
    void fn()
      .then((idx) => {
        if (!live || !idx) return;
        const d = idx["default"] as Record<string, unknown> | undefined;
        if (!d) return;
        setMeta({
          command: typeof d["promptCommand"] === "string" && d["promptCommand"].trim() ? d["promptCommand"] : null,
          submit: typeof d["promptSubmit"] === "string" && d["promptSubmit"].trim() ? d["promptSubmit"] : null,
        });
      })
      .catch(() => {
        /* keep fallbacks */
      });
    return () => {
      live = false;
    };
  }, []);

  return meta;
}

export function PromptDialog({
  command,
  expectedAnswer,
  minLength = 1,
  maxLength = 100,
  onClose,
}: PromptDialogProps) {
  const promptMistakes = useSettingsStore((s) => s.promptMistakes);
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const lkToggle = useSettingsStore((s) => s.lkToggle);
  const meta = usePackPromptMeta();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const instruction = meta?.command ?? command ?? "";
  const submitLabel = meta?.submit ?? "Submit";

  const handleSubmit = useCallback(() => {
    if (input.length < minLength) {
      setError(`Too short (minimum ${minLength} characters)`);
      return;
    }
    if (input.length > maxLength) {
      setError(`Too long (maximum ${maxLength} characters)`);
      return;
    }

    const distance = levenshteinDistance(input.toLowerCase(), expectedAnswer.toLowerCase());
    if (distance <= promptMistakes) {
      onClose?.(true);
    } else {
      setError(`Try again. You need ${Math.max(0, promptMistakes - distance)} fewer mistakes`);
    }
  }, [input, expectedAnswer, minLength, maxLength, promptMistakes, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <PopupShell
      onClose={() => onClose?.(false)}
      buttonless={false}
      clicksToClose={0}
      clickthroughEnabled={false}
      timeoutMs={0}
      opacity={lkToggle === 1 && lkScaling > 0 ? lkScaling / 100 : 1}
    >
      <Paper
        data-testid="prompt-dialog"
        withBorder
        radius="lg"
        p="lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "rgba(14, 17, 25, 0.94)",
          borderColor: "var(--mantine-color-dark-5)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          maxWidth: 500,
          maxHeight: "100%",
          overflow: "hidden",
          color: "white",
        }}
      >
        <Stack gap="md">
          {instruction && (
            <Title order={3} ta="center" c="white">
              {instruction}
            </Title>
          )}

          <Text data-testid="prompt-phrase" c="white" size="sm" ta="center" style={{ whiteSpace: "pre-wrap" }}>
            {expectedAnswer}
          </Text>

          <TextInput
            data-testid="prompt-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            style={{ color: "white" }}
          />

          {error && (
            <Text data-testid="prompt-error" c="red" size="sm" ta="center">
              {error}
            </Text>
          )}

          <Group justify="center">
            <Button
              data-testid="prompt-submit"
              onClick={handleSubmit}
              variant="filled"
              fw={600}
              leftSection={<IconCheck size={15} />}
            >
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </PopupShell>
  );
}
