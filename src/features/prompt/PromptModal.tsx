import { useState, useCallback } from 'react'
import { Modal, Textarea, TextInput, Button, Group, Text } from '@mantine/core'
import { usePromptStore } from '@/stores/promptStore'

export function PromptModal() {
  const {
    active,
    text: promptText,
    maxMistakes,
    minLength,
    maxLength,
    onClose,
    deactivate,
  } = usePromptStore()

  const [input, setInput] = useState('')
  const [localMistakes, setLocalMistakes] = useState(0)

  const handleSubmit = useCallback(() => {
    if (input.length < minLength) return
    if (input.length > maxLength) return

    const dist = levenshtein(input.toLowerCase(), promptText.toLowerCase())
    if (dist > maxMistakes) {
      setLocalMistakes((p) => p + 1)
      setInput('')
      return
    }

    deactivate()
    setLocalMistakes(0)
    setInput('')
    onClose?.()
  }, [input, promptText, minLength, maxLength, maxMistakes, deactivate, onClose])

  const handleClose = useCallback(() => {
    deactivate()
    setLocalMistakes(0)
    setInput('')
    onClose?.()
  }, [deactivate, onClose])

  if (!active) return null

  return (
    <Modal
      opened={active}
      onClose={handleClose}
      title="Prompt"
      centered
      size="lg"
    >
      <Text size="sm" mb="xs">
        Type the following text:
      </Text>
      <Textarea
        value={promptText}
        readOnly
        autosize
        minRows={3}
        mb="md"
        styles={{ input: { fontFamily: 'monospace' } }}
      />
      <TextInput
        placeholder="Your response"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        mb="xs"
      />
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">
          {promptText.length - maxMistakes}..{promptText.length + maxMistakes} chars • {maxMistakes} mistakes allowed
        </Text>
        <Group>
          <Text size="xs" c="red">
            Mistakes: {localMistakes}/{maxMistakes}
          </Text>
          <Button size="xs" onClick={handleSubmit}>
            Submit
          </Button>
        </Group>
      </Group>
    </Modal>
  )
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
