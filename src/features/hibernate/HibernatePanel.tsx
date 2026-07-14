import { SegmentedControl, Stack, Text, Button, Group, Badge } from '@mantine/core'
import { useHibernateStore } from '@/stores/hibernateStore'

const hibernateTypes: { value: string; label: string }[] = [
  { value: 'Original', label: 'Original' },
  { value: 'Spaced', label: 'Spaced' },
  { value: 'Glitch', label: 'Glitch' },
  { value: 'Ramp', label: 'Ramp' },
  { value: 'Pump-Scare', label: 'Pump-Scare' },
  { value: 'Chaos', label: 'Chaos' },
]

export function HibernatePanel() {
  const { active, type, activate, deactivate } = useHibernateStore()

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>Hibernate Mode</Text>
        <Badge color={active ? 'grape' : 'gray'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed">
        Hibernate mode allows the program to run in a passive state, spawning events less frequently.
      </Text>

      <SegmentedControl
        value={type}
        onChange={(v) => activate(v as typeof type)}
        data={hibernateTypes}
        fullWidth
      />

      <Group>
        <Button
          color={active ? 'red' : 'grape'}
          onClick={active ? deactivate : () => activate(type)}
        >
          {active ? 'Deactivate' : 'Activate'}
        </Button>
      </Group>
    </Stack>
  )
}
