import { useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import { useElectronAPI } from '@/hooks/useElectronAPI'
import { SplashScreen } from '@/components/SplashScreen'
import { PopupContainer } from '@/components/PopupContainer'
import { ConfigPanel } from '@/features/config/ConfigPanel'
import { PromptModal } from '@/features/prompt/PromptModal'
import { HibernatePanel } from '@/features/hibernate/HibernatePanel'
import { Container, Title, Text, Anchor } from '@mantine/core'

function StatusPage() {
  return (
    <Container size="xs" py="xl">
      <Title order={3} ta="center" mb="md">Edgeware++ Running</Title>
      <Text ta="center" c="dimmed" size="sm">
        Edgeware++ is running in the background. Popups will appear as configured.
      </Text>
      <Text ta="center" c="dimmed" size="xs" mt="md">
        <Anchor href="#/config">Open Configuration</Anchor>
      </Text>
    </Container>
  )
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function roll(percent: number): boolean {
  return Math.random() * 100 < percent
}

function pickDenialFilter(): string {
  const filters = [
    `blur(${randomInt(1, 5)}px)`,
    `saturate(${randomInt(0, 50)}%)`,
    `brightness(${randomInt(30, 80)}%)`,
    `blur(${randomInt(1, 3)}px) saturate(${randomInt(0, 30)}%)`,
    `blur(${randomInt(2, 4)}px) brightness(${randomInt(40, 70)}%)`,
    `saturate(0%)`,
    `hue-rotate(${randomInt(60, 300)}deg) saturate(${randomInt(0, 50)}%)`,
  ]
  return pickRandom(filters)
}

export default function App() {
  const { inPanicMode, splashComplete, running, completeSplash } = useAppStore()
  const electronAPI = useElectronAPI()
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!electronAPI) return
    electronAPI.loadConfig()
      .then((savedConfig) => {
        useConfigStore.getState().updateConfig(savedConfig)
      })
      .catch((err) => console.error('config:load failed', err))
  }, [electronAPI])

  useEffect(() => {
    if (!electronAPI) return
    electronAPI.onPanic(() => {
      useAppStore.getState().triggerPanic()
    })
    electronAPI.onKeyEvent((_type, key) => {
      if (key === useConfigStore.getState().panicButton) {
        useAppStore.getState().triggerPanic()
      }
    })
    electronAPI.onTrayAction((action) => {
      if (action === 'panic') {
        useAppStore.getState().triggerPanic()
      }
    })
  }, [electronAPI])

  // Popup spawning loop
  useEffect(() => {
    if (!running) {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current)
        spawnTimerRef.current = null
      }
      return
    }

    const tick = () => {
      const { inPanicMode: panicked } = useAppStore.getState()
      if (panicked) return

      const pack = usePackStore.getState().pack
      if (!pack) return

      const cfg = useConfigStore.getState()
      const popup = usePopupStore.getState()
      if (popup.popupCount >= cfg.maxVideos) return

      const images = pack.media.images
      const videos = pack.media.videos
      const audio = pack.media.audio
      const hasNonAudio = images.length + videos.length > 0
      const pool = hasNonAudio ? [...images, ...videos] : audio
      if (pool.length === 0) return

      const path = pickRandom(pool)
      const isVideo = videos.includes(path)
      const isAudio = audio.includes(path)

      if (isAudio) {
        usePopupStore.getState().addPopup({
          type: 'audio',
          mediaPath: path,
          x: 0, y: 0, width: 0, height: 0,
          opacity: 100,
          clickthrough: true,
          clicksToClose: 1,
        })
      } else {
        const w = randomInt(200, 400)
        const h = randomInt(150, 300)
        const x = randomInt(0, window.innerWidth - w)
        const y = randomInt(0, window.innerHeight - h)

        usePopupStore.getState().addPopup({
          type: isVideo ? 'video' : 'image',
          mediaPath: path,
          x, y, width: w, height: h,
          opacity: 100,
          clickthrough: cfg.clickthroughPopups,
          clicksToClose: cfg.buttonless ? 999 : 1,
          denialFilter: roll(cfg.denialChance) ? pickDenialFilter() : undefined,
          hypnoMediaPath: roll(cfg.subliminalsChance) && pack.media.hypno.length > 0
            ? pickRandom(pack.media.hypno)
            : undefined,
          hypnoOpacity: cfg.subliminalsAlpha,
        })
      }
    }

    spawnTimerRef.current = setInterval(tick, useConfigStore.getState().delay)
    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current)
        spawnTimerRef.current = null
      }
    }
  }, [running])

  const handleSplashComplete = useCallback(() => {
    completeSplash()
  }, [completeSplash])

  if (inPanicMode) {
    return (
      <Container size="xs" py="xl" ta="center">
        <Title order={2} c="red">PANIC MODE</Title>
        <Text c="dimmed" mt="md">
          All popups have been closed. Press "Clear Panic" in the config panel to resume.
        </Text>
      </Container>
    )
  }

  return (
    <>
      {!splashComplete && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}

      <Routes>
        <Route path="/" element={<ConfigPanel />} />
        <Route path="/config" element={<ConfigPanel />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/hibernate" element={<HibernatePanel />} />
      </Routes>

      {running && (
        <Container size="xs" py="sm" ta="center">
          <Text size="sm" c="grape">Edgeware++ Running — {usePopupStore.getState().popupCount} popups active</Text>
        </Container>
      )}

      <PromptModal />
      <PopupContainer />
    </>
  )
}
