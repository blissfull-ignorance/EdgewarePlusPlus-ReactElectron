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
import { shouldMove, randomDirection, tickPopups } from '@/features/popup/movement'
import { logMovementEvent } from '@/features/popup/debug'
import { Container, Title, Text, Anchor } from '@mantine/core'

// DISCUSSION: audioIdCounter is module-level, not reset on pack change. If packs
// are swapped mid-session, audio IDs could collide with stale popup entries.
// Consider resetting on pack load, but low risk since audio popups are ephemeral.
let audioIdCounter = 1

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

// --- Utility helpers (pure, no side effects) ---

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Returns true with `percent` probability (0–100). */
function roll(percent: number): boolean {
  return Math.random() * 100 < percent
}

// REMOVABLE: STATIC_IMG_EXTS + extOf are duplicated conceptually in pack.ts
// (IMAGE_EXTS, HYPN_EXTS). Consider extracting a shared media-utils module if
// more extension checks are needed. Currently acceptable since App.tsx only
// needs a lightweight "is this a static image?" check without importing pack internals.
const STATIC_IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp'])

function extOf(filePath: string): string {
  const i = filePath.lastIndexOf('.')
  return i >= 0 ? filePath.slice(i).toLowerCase() : ''
}

/** Generates a random CSS filter for denial popups (blur, desaturation, etc.). */
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
  const popupCount = usePopupStore((s) => s.popupCount)
  const electronAPI = useElectronAPI()
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // DISCUSSION: screenRef defaults to 1920x1080 as a fallback. If the actual
  // screen is smaller, popups could spawn off-screen. The getScreenBounds IPC
  // call on mount should overwrite this quickly, but there's a brief window
  // where the default is used.
  const screenRef = useRef({ width: 1920, height: 1080 })

  // Fetch actual screen bounds from Electron on mount
  useEffect(() => {
    if (!electronAPI) return
    electronAPI.getScreenBounds().then((bounds) => {
      screenRef.current = { width: bounds.width, height: bounds.height }
    }).catch(() => {})
  }, [electronAPI])

  // Load persisted config from disk on mount
  useEffect(() => {
    if (!electronAPI) return
    electronAPI.loadConfig()
      .then((savedConfig) => {
        useConfigStore.getState().updateConfig(savedConfig)
      })
      .catch((err) => console.error('config:load failed', err))
  }, [electronAPI])

  // Register Electron IPC event listeners (panic, key, tray, popup closed)
  useEffect(() => {
    if (!electronAPI) return
    electronAPI.onPanic(() => {
      useAppStore.getState().triggerPanic()
      usePopupStore.getState().clearPopups()
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
    electronAPI.onPopupClosed((id) => {
      usePopupStore.getState().removePopup(id)
    })
  }, [electronAPI])

  // --- Popup spawning loop ---
  // Runs at configurable interval (cfg.delay). Each tick:
  //   1. Picks a random media file from the loaded pack
  //   2. Checks per-type limits (maxImages, maxVideos)
  //   3. Decides hypno overlay eligibility (static images only)
  //   4. Creates a BrowserWindow via IPC and registers the popup in the store
  //
  // FUTUREWORK: The spawn tick re-reads cfg.delay only when `running` changes,
  // not on every tick. If the user changes delay while running, the old interval
  // persists until next start/stop. Consider clearing and resetting the timer
  // when cfg.delay changes.
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

      const images = pack.media.images
      const videos = pack.media.videos
      const audio = pack.media.audio

      // If no images/videos exist, fall back to audio-only spawning
      const hasNonAudio = images.length + videos.length > 0
      if (!hasNonAudio && audio.length === 0) return

      const path = pickRandom(hasNonAudio ? [...images, ...videos] : audio)
      const isVideo = videos.includes(path)
      const isAudio = audio.includes(path)

      if (isAudio) {
        // Audio popups have no visual representation, just a store entry
        const id = audioIdCounter++
        usePopupStore.getState().addPopup({ id, type: 'audio', mediaPath: path, x: 0, y: 0, width: 0, height: 0, moving: false, dx: 0, dy: 0 })
      } else {
        // Enforce per-type popup limits
        const popups = usePopupStore.getState().popups
        const currentImages = popups.filter((p) => p.type === 'image').length
        const currentVideos = popups.filter((p) => p.type === 'video').length
        if (isVideo && currentVideos >= cfg.maxVideos) return
        if (!isVideo && currentImages >= cfg.maxImages) return

        // Scale popup dimensions by user-configured popupScale
        const scale = cfg.popupScale || 1
        const w = Math.round(randomInt(200, 400) * scale)
        const h = Math.round(randomInt(150, 300) * scale)
        const bounds = screenRef.current
        const x = randomInt(0, Math.max(0, bounds.width - w))
        const y = randomInt(0, Math.max(0, bounds.height - h))

        if (electronAPI) {
          // Hypno overlay: only applied to static images (not gifs, not videos)
          const mediaExt = extOf(path)
          const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
          const hypnoMediaPath = isStaticImage && roll(cfg.subliminalsChance) && pack.media.hypno.length > 0
            ? pickRandom(pack.media.hypno)
            : undefined
          console.log('[spawn:hypno]', {
            hypnoMediaPath: hypnoMediaPath || '(none)',
            isStaticImage,
            subliminalsChance: cfg.subliminalsChance,
            hypnoPoolSize: pack.media.hypno.length,
            opacity: cfg.subliminalsAlpha,
          })
          electronAPI.createPopup({
            mediaPath: path,
            type: isVideo ? 'video' : 'image',
            width: w,
            height: h,
            x,
            y,
            opacity: 100,
            clickthrough: cfg.clickthroughPopups,
            clicksToClose: cfg.buttonless ? 999 : 1,
            denialFilter: roll(cfg.denialChance) ? pickDenialFilter() : undefined,
            hypnoMediaPath,
            hypnoOpacity: cfg.subliminalsAlpha,
          }).then((popupId) => {
            // Assign movement parameters: direction is random, moving is probabilistic
            const dir = randomDirection()
            const moving = shouldMove(cfg.movingChance)
            console.log('[spawn]', { popupId, moving, movingChance: cfg.movingChance, x, y, w, h })
            usePopupStore.getState().addPopup({
              id: popupId, type: isVideo ? 'video' : 'image',
              x, y, width: w, height: h,
              moving,
              dx: dir.dx, dy: dir.dy,
            })
            logMovementEvent({ ts: Date.now(), type: 'spawn', popupId, moving, x, y, dx: dir.dx, dy: dir.dy })
          }).catch((err) => {
            console.error('createPopup failed', err)
          })
        }
      }
    }

    spawnTimerRef.current = setInterval(tick, useConfigStore.getState().delay)
    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current)
        spawnTimerRef.current = null
      }
    }
  }, [running, electronAPI])

  // --- Popup movement loop ---
  // Runs at fixed 50ms interval (20 ticks/sec). Each tick:
  //   1. Reads current popup positions and config from stores
  //   2. Calls tickPopups() to compute new positions with bounce
  //   3. Sends movePopup IPC calls with Math.round() coordinates
  //   4. Updates store positions for next tick
  //
  // FUTUREWORK: Movement speed slider could update the interval instead of
  // being read per-tick. Current approach is simpler and sufficient.
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running || !electronAPI) {
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
        moveTimerRef.current = null
      }
      return
    }

    const moveTick = () => {
      const cfg = useConfigStore.getState()
      const bounds = screenRef.current
      const popups = usePopupStore.getState().popups
      const movingCount = popups.filter((p) => p.moving).length
      const updates = tickPopups(popups, cfg.movingSpeed, bounds)
      if (popups.length > 0) {
        console.log('[movement:tick]', { total: popups.length, movingCount, speed: cfg.movingSpeed, bounds, updateCount: updates.size })
      }
      for (const [id, update] of updates) {
        // Math.round() is critical: Electron IPC throws on float coordinates
        electronAPI.movePopup(id, Math.round(update.x), Math.round(update.y)).catch(() => {})
        usePopupStore.getState().updatePopup(id, { ...update, x: Math.round(update.x), y: Math.round(update.y) })
        console.log('[movement:move]', { id, x: Math.round(update.x), y: Math.round(update.y), dx: update.dx, dy: update.dy })
        logMovementEvent({ ts: Date.now(), type: 'move', popupId: id, x: Math.round(update.x), y: Math.round(update.y), dx: update.dx, dy: update.dy })
      }
    }

    console.log('[movement] effect started', { running, electronAPI: !!electronAPI })
    moveTimerRef.current = setInterval(moveTick, 50)
    return () => {
      console.log('[movement] effect cleanup')
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current)
        moveTimerRef.current = null
      }
    }
  }, [running, electronAPI])

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
          <Text size="sm" c="grape">Edgeware++ Running — {popupCount} popups active</Text>
        </Container>
      )}

      <PromptModal />
      <PopupContainer />
    </>
  )
}
