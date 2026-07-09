import { useEffect, useState } from 'react'
import { Center, Stack, Title, Text, Loader } from '@mantine/core'

interface SplashScreenProps {
  onComplete: () => void
  duration?: number
}

export function SplashScreen({ onComplete, duration = 2000 }: SplashScreenProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onComplete, 500)
    }, duration)
    return () => clearTimeout(timer)
  }, [onComplete, duration])

  if (!visible) return null

  return (
    <Center
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'var(--mantine-color-dark-9)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      <Stack align="center" gap="lg">
        <Title order={1} c="grape.5">
          Edgeware++
        </Title>
        <Text c="dimmed" size="sm">
          Loading configuration...
        </Text>
        <Loader color="grape" size="sm" />
      </Stack>
    </Center>
  )
}
