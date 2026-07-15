import { useState, useCallback } from 'react'
import { Modal, TextInput, Button, Group, Text } from '@mantine/core'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { validateSafeword } from '@/features/panic/panic'

export function SafewordModal() {
  const { isLockedOut, clearLockout } = useAppStore()
  const safeword = useConfigStore((s) => s.safeword)

  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = useCallback(() => {
    if (validateSafeword(input, safeword)) {
      clearLockout()
      setInput('')
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }, [input, safeword, clearLockout])

  const handleClose = useCallback(() => {
    setError(false)
    setInput('')
  }, [])

  if (!isLockedOut) return null

  return (
    <Modal
      opened={isLockedOut}
      onClose={handleClose}
      title="Lockout Active"
      centered
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    >
      <Text size="sm" mb="xs">
        Enter the safeword to exit lockout.
      </Text>
      <TextInput
        placeholder="Safeword"
        value={input}
        onChange={(e) => {
          setInput(e.currentTarget.value)
          setError(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        error={error ? 'Incorrect safeword' : undefined}
        mb="xs"
      />
      <Group justify="flex-end" mt="sm">
        <Button size="xs" onClick={handleSubmit}>
          Submit
        </Button>
      </Group>
    </Modal>
  )
}
