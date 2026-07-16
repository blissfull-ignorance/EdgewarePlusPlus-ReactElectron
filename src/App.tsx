import { useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import { useCorruptionStore } from '@/stores/corruptionStore'
import { useDiscordStore } from '@/stores/discordStore'
import { useElectronAPI } from '@/hooks/useElectronAPI'
import { attachScriptListeners } from '@/stores/scriptStore'
import { SplashScreen } from '@/components/SplashScreen'
import { PopupContainer } from '@/components/PopupContainer'
import { ConfigPanel } from '@/features/config/ConfigPanel'
import { PromptModal } from '@/features/prompt/PromptModal'
import { HibernatePanel } from '@/features/hibernate/HibernatePanel'
import { useHibernateStore } from '@/stores/hibernateStore'
import { planActivity, hibernateDelay, shouldResetWallpaper } from '@/features/hibernate/hibernate'
import type { HibernateType } from '@/features/hibernate/hibernate'
import { shouldMove, randomDirection, tickPopups, computeSpawnPosition } from '@/features/popup/movement'
import { computeSpawnPools, pickSingleType } from '@/features/popup/spawn'
import { filterMediaByMood } from '@/features/corruption/corruption'
import type { PackAsset } from '@/features/corruption/corruption'
import type { OccupiedZone } from '@/features/popup/movement'
import { getExpiredPopupIds } from '@/features/popup/timeout'
import { logMovementEvent } from '@/features/popup/debug'
import { shouldBlockPanic } from '@/features/panic/panic'
import { computeRotation, shouldRotate } from '@/features/wallpaper/rotation'
import { SafewordModal } from '@/features/panic/SafewordModal'
import { Container, Title, Text, Anchor } from '@mantine/core'

// DISCUSSION: audioIdCounter is module-level, not reset on pack change. If packs
// are swapped mid-session, audio IDs could collide with stale popup entries.
// Consider resetting on pack load, but low risk since audio popups are ephemeral.
let audioIdCounter = 1

// DISCUSSION: mitosisIdCounter is separate from audioIdCounter to avoid collisions.
// Both are module-level and could drift if the session spans pack changes, but
// the risk is negligible since popup IDs only need to be unique within a session.
let mitosisIdCounter = 1

function spawnMitosisPopup(
  closedType: 'image' | 'video' | 'audio',
  electronAPI: ReturnType<typeof useElectronAPI>,
) {
  const pack = usePackStore.getState().pack
  if (!pack) return

  const cfg = useConfigStore.getState()
  const bounds = { width: 1920, height: 1080 }

  if (closedType === 'audio') {
    const audioPool = pack.media.audio
    if (audioPool.length === 0) return
    const mediaPath = pickRandom(audioPool)
    const id = 100000 + mitosisIdCounter++
    usePopupStore.getState().addPopup({
      id, type: 'audio', mediaPath, x: 0, y: 0, width: 0, height: 0,
      moving: false, dx: 0, dy: 0, mitosisSpawned: true, spawnTime: Date.now(),
    })
    return
  }

  const pool = closedType === 'video' ? pack.media.videos : pack.media.images
  if (pool.length === 0) return
  const mediaPath = pickRandom(pool)

  const scale = cfg.popupScale || 1
  const w = Math.round(randomInt(200, 400) * scale)
  const h = Math.round(randomInt(150, 300) * scale)
  const occupied: OccupiedZone[] = usePopupStore.getState().popups
  const { x, y } = computeSpawnPosition(w, h, bounds, occupied)

  if (electronAPI) {
    const mediaExt = extOf(mediaPath)
    const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
    const hypnoMediaPath = isStaticImage && roll(cfg.subliminalsChance) && pack.media.hypno.length > 0
      ? pickRandom(pack.media.hypno)
      : undefined

    electronAPI.createPopup({
      mediaPath,
      type: closedType,
      width: w,
      height: h,
      x,
      y,
      opacity: 100,
      clickthrough: cfg.clickthroughPopups,
      clicksToClose: cfg.buttonless ? 999 : 1,
      popupClose: usePackStore.getState().getPopupCloseText(),
      buttonless: cfg.buttonless,
      denialFilter: roll(cfg.denialChance) ? pickDenialFilter() : undefined,
      hypnoMediaPath,
      hypnoOpacity: cfg.subliminalsAlpha,
    }).then((popupId) => {
      const dir = randomDirection()
      const moving = shouldMove(cfg.movingChance)
      usePopupStore.getState().addPopup({
        id: popupId, type: closedType,
        x, y, width: w, height: h,
        moving,
        dx: dir.dx, dy: dir.dy,
        mitosisSpawned: true,
        spawnTime: Date.now(),
      })
    }).catch((err) => {
      console.error('mitosis:createPopup failed', err)
    })
  }
}

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
  const { inPanicMode, isLockedOut, splashComplete, running, completeSplash } = useAppStore()
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
        if (savedConfig.showDiscord) {
          useDiscordStore.getState().initPresence()
        }
        if (savedConfig.timerMode && savedConfig.timerSetupTime > 0) {
          electronAPI.startLockout(savedConfig.timerSetupTime)
        }
      })
      .catch((err) => console.error('config:load failed', err))
  }, [electronAPI])

  // Register Electron IPC event listeners (panic, key, tray, popup closed, lockout)
  useEffect(() => {
    if (!electronAPI) return
    electronAPI.onPanic(() => {
      const appState = useAppStore.getState()
      if (shouldBlockPanic(appState.inPanicMode, appState.lockoutEndTime)) return
      appState.triggerPanic()
      usePopupStore.getState().clearPopups()
      useDiscordStore.getState().destroyPresence()
    })
    electronAPI.onKeyEvent((_type, key) => {
      if (key === useConfigStore.getState().panicButton) {
        const appState = useAppStore.getState()
        if (shouldBlockPanic(appState.inPanicMode, appState.lockoutEndTime)) return
        appState.triggerPanic()
        useDiscordStore.getState().destroyPresence()
      }
    })
    electronAPI.onTrayAction((action) => {
      if (action === 'panic') {
        const appState = useAppStore.getState()
        if (shouldBlockPanic(appState.inPanicMode, appState.lockoutEndTime)) return
        appState.triggerPanic()
        useDiscordStore.getState().destroyPresence()
      }
    })
    electronAPI.onLockoutStart((endTime) => {
      useAppStore.getState().startLockout(endTime)
    })
    electronAPI.onLockoutClear(() => {
      useAppStore.getState().clearLockout()
    })
    electronAPI.onPopupClosed((id) => {
      const state = usePopupStore.getState()
      const popup = state.popups.find((p) => p.id === id)
      state.removePopup(id)

      if (!popup || popup.mitosisSpawned) return

      const cfg = useConfigStore.getState()
      if (!cfg.mitosisMode) return
      if (!roll(cfg.mitosisChance)) return

      const count = randomInt(1, cfg.mitosisStrength)
      for (let i = 0; i < count; i++) {
        spawnMitosisPopup(popup.type, electronAPI)
      }
    })
    attachScriptListeners()

    const unsubDiscord = useConfigStore.subscribe((state, prev) => {
      if (state.showDiscord !== prev.showDiscord) {
        if (state.showDiscord) {
          useDiscordStore.getState().initPresence()
        } else {
          useDiscordStore.getState().destroyPresence()
        }
      }
    })

    return () => { unsubDiscord() }
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

      if (cfg.capPopChance > 0 && roll(cfg.capPopChance)) {
        const subliminals = usePackStore.getState().getTexts('subliminal')
        if (subliminals.length > 0 && electronAPI) {
          electronAPI.createSubliminal({
            text: pickRandom(subliminals),
            color: cfg.capPopTextColor,
            opacity: cfg.capPopOpacity,
            duration: cfg.capPopTimer,
            fontSize: cfg.capPopTextSize,
          })
        }
      }

      const corruptionMoods = useCorruptionStore.getState().activeMoods
      const moodLookup = new Map<string, string>()
      for (const assets of Object.values(pack.index)) {
        for (const asset of assets as PackAsset[]) {
          if (asset.mood) moodLookup.set(asset.path, asset.mood)
        }
      }

      const filteredImages = filterMediaByMood(pack.media.images, corruptionMoods, moodLookup)
      const filteredVideos = filterMediaByMood(pack.media.videos, corruptionMoods, moodLookup)
      const filteredAudio = filterMediaByMood(pack.media.audio, corruptionMoods, moodLookup)

      const pools = computeSpawnPools({
        images: filteredImages,
        videos: filteredVideos,
        audio: filteredAudio,
        popupMod: cfg.popupMod,
        vidMod: cfg.vidMod,
        audioMod: cfg.audioMod,
      })

      const { eligibleImages, eligibleVideos, eligibleAudio } = pools
      let visualPath: string
      let isVideo: boolean

      if (cfg.singleMode) {
        const selected = pickSingleType({
          images: cfg.popupMod,
          videos: cfg.vidMod,
          audio: cfg.audioMod,
        })

        if (selected === 'audio') {
          if (eligibleAudio.length > 0) {
            const popups = usePopupStore.getState().popups
            const currentAudio = popups.filter((p) => p.type === 'audio').length
            if (currentAudio < cfg.maxAudio) {
              const audioPath = pickRandom(eligibleAudio)
              const id = audioIdCounter++
              usePopupStore.getState().addPopup({ id, type: 'audio', mediaPath: audioPath, x: 0, y: 0, width: 0, height: 0, moving: false, dx: 0, dy: 0, mitosisSpawned: false, spawnTime: Date.now() })
            }
          }
          return
        }

        const eligibleVisual = selected === 'images' ? eligibleImages : eligibleVideos
        if (eligibleVisual.length === 0) return
        visualPath = pickRandom(eligibleVisual)
        isVideo = selected === 'videos'
      } else {
        if (eligibleImages.length + eligibleVideos.length === 0 && eligibleAudio.length === 0) return

        if (eligibleAudio.length > 0) {
          const popups = usePopupStore.getState().popups
          const currentAudio = popups.filter((p) => p.type === 'audio').length
          if (currentAudio < cfg.maxAudio) {
            const audioPath = pickRandom(eligibleAudio)
            const id = audioIdCounter++
            usePopupStore.getState().addPopup({ id, type: 'audio', mediaPath: audioPath, x: 0, y: 0, width: 0, height: 0, moving: false, dx: 0, dy: 0, mitosisSpawned: false, spawnTime: Date.now() })
          }
        }

        const visualPool = [...eligibleImages, ...eligibleVideos]
        if (visualPool.length === 0) return
        visualPath = pickRandom(visualPool)
        isVideo = eligibleVideos.includes(visualPath)
      }

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
      const occupied: OccupiedZone[] = usePopupStore.getState().popups
      const { x, y } = computeSpawnPosition(w, h, bounds, occupied)

      if (electronAPI) {
        // Hypno overlay: only applied to static images (not gifs, not videos)
        const mediaExt = extOf(visualPath)
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
          mediaPath: visualPath,
          type: isVideo ? 'video' : 'image',
          width: w,
          height: h,
          x,
          y,
          opacity: 100,
          clickthrough: cfg.clickthroughPopups,
          clicksToClose: cfg.buttonless ? 999 : 1,
          popupClose: usePackStore.getState().getPopupCloseText(),
          buttonless: cfg.buttonless,
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
            mitosisSpawned: false,
            spawnTime: Date.now(),
          })
          logMovementEvent({ ts: Date.now(), type: 'spawn', popupId, moving, x, y, dx: dir.dx, dy: dir.dy })
        }).catch((err) => {
          console.error('createPopup failed', err)
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
      const { inPanicMode: panicked } = useAppStore.getState()
      if (panicked) return

      const cfg = useConfigStore.getState()
      const bounds = screenRef.current
      const popups = usePopupStore.getState().popups
      const movingCount = popups.filter((p) => p.moving).length
      const updates = tickPopups(popups, cfg.movingSpeed, bounds)
      if (popups.length > 0) {
        console.log('[movement:tick]', { total: popups.length, movingCount, speed: cfg.movingSpeed, bounds, updateCount: updates.size })
      }
      for (const [id, update] of updates) {
        electronAPI.movePopup(id, Math.round(update.x), Math.round(update.y)).catch(() => {})
        usePopupStore.getState().updatePopup(id, { ...update, x: Math.round(update.x), y: Math.round(update.y) })
        console.log('[movement:move]', { id, x: Math.round(update.x), y: Math.round(update.y), dx: update.dx, dy: update.dy })
        logMovementEvent({ ts: Date.now(), type: 'move', popupId: id, x: Math.round(update.x), y: Math.round(update.y), dx: update.dx, dy: update.dy })
      }

      if (cfg.timeoutPopups) {
        const now = Date.now()
        const expiredIds = getExpiredPopupIds(popups, cfg.popupTimeout, now)
        for (const id of expiredIds) {
          electronAPI.closePopup(id).catch(() => {})
          usePopupStore.getState().removePopup(id)
        }
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

  // --- Discord presence updates ---
  useEffect(() => {
    useDiscordStore.getState().updatePresence()
  }, [popupCount])

  const pack = usePackStore((s) => s.pack)
  useEffect(() => {
    useDiscordStore.getState().updatePresence()
  }, [pack])

  useEffect(() => {
    return () => { useDiscordStore.getState().destroyPresence() }
  }, [])

  // --- Corruption runtime ---
  // Initializes corruption on startup and manages trigger-based level progression.
  // Timed: recursive setTimeout advancing level at cfg.corruptionTime intervals.
  // Popup: subscribes to popup store, advances after cfg.corruptionPopups closed.
  // Launch: advances once on startup based on launch count (FUTUREWORK: persist count).
  // Script: level advanced externally via ew.progress_corruption().
  //
  // FUTUREWORK: Add corruption danger check dialog when full-perm mode is enabled.
  // FUTUREWORK: Persist launch count via Electron IPC to userData.
  const corruptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const corruptionUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!running) {
      if (corruptionTimerRef.current) {
        clearTimeout(corruptionTimerRef.current)
        corruptionTimerRef.current = null
      }
      return
    }

    const cfg = useConfigStore.getState()
    if (!cfg.corruptionMode) return

    const pack = usePackStore.getState().pack
    if (!pack || pack.corruptionLevels.length === 0) return

    const cs = useCorruptionStore.getState()

    // Initialize corruption levels from pack if not already done
    if (!cs.initialized) {
      useCorruptionStore.getState().setCorruptionLevels(pack.corruptionLevels)
      useCorruptionStore.getState().setTriggerType(cfg.corruptionTrigger as 'Timed' | 'Popup' | 'Launch' | 'Script')
      useCorruptionStore.getState().setFadeType(cfg.corruptionFadeType as 'Normal' | 'Abrupt' | 'Glitch' | 'Ramp')
      useCorruptionStore.getState().setMaxLevel(pack.corruptionLevels.length)

      if (cfg.corruptionPurityMode) {
        useCorruptionStore.getState().setLevel(pack.corruptionLevels.length)
      } else {
        useCorruptionStore.getState().setLevel(1)
      }

      useCorruptionStore.getState().applyLevelEffects()
    }

    // Apply config overrides from corruption level
    const corruptionOverrides = useCorruptionStore.getState().configOverrides
    if (Object.keys(corruptionOverrides).length > 0) {
      useConfigStore.getState().updateConfig(corruptionOverrides)
    }

    const trigger = cfg.corruptionTrigger

    if (trigger === 'Timed') {
      // Convert minutes to ms; Python uses corruption_time directly in ms after s_to_ms
      const intervalMs = cfg.corruptionTime * 60 * 1000

      useCorruptionStore.getState().setCorruptionTimeStart(Date.now())

      const scheduleNext = () => {
        corruptionTimerRef.current = setTimeout(() => {
          const { inPanicMode: panicked } = useAppStore.getState()
          if (panicked) return

          useCorruptionStore.getState().advanceLevel()

          // Apply config overrides after level advance
          const newOverrides = useCorruptionStore.getState().configOverrides
          if (Object.keys(newOverrides).length > 0) {
            useConfigStore.getState().updateConfig(newOverrides)
          }

          useCorruptionStore.getState().setCorruptionTimeStart(Date.now())
          scheduleNext()
        }, intervalMs)
      }

      scheduleNext()
    } else if (trigger === 'Popup') {
      const unsub = usePopupStore.subscribe((state, prev) => {
        // Only count when popupCount increases (popup spawned)
        if (state.popupCount > prev.popupCount) {
          const cs = useCorruptionStore.getState()
          cs.incrementPopupCount()

          if (cs.corruptionPopupCount >= cfg.corruptionPopups) {
            cs.advanceLevel()
            cs.resetPopupCount()

            const newOverrides = useCorruptionStore.getState().configOverrides
            if (Object.keys(newOverrides).length > 0) {
              useConfigStore.getState().updateConfig(newOverrides)
            }
          }
        }
      })

      corruptionUnsubRef.current = unsub
    } else if (trigger === 'Launch') {
      // FUTUREWORK: Read persistent launch count from Electron IPC.
      // For now, apply initial level effects only.
      useCorruptionStore.getState().applyLevelEffects()
    }

    return () => {
      if (corruptionTimerRef.current) {
        clearTimeout(corruptionTimerRef.current)
        corruptionTimerRef.current = null
      }
      if (corruptionUnsubRef.current) {
        corruptionUnsubRef.current()
        corruptionUnsubRef.current = null
      }
    }
  }, [running])

  // --- Hibernate runtime ---
  // When hibernateMode is enabled and no popups are active, starts a sleep timer
  // with random delay between hibernateMin and hibernateMax. On fire, runs the
  // activity schedule for the configured type. On completion, checks wallpaper reset.
  //
  // FUTUREWORK: Add hibernate timer display in UI (countdown to next activity).
  // FUTUREWORK: Support schedule-based hibernate activation (time-of-day triggers).
  // FUTUREWORK: If the user changes hibernate config (type, length, activity)
  // mid-sleep, the current timer uses old values. A store subscription could
  // cancel and restart the timer when hibernateMin/hibernateMax/hibernateType change.
  const hibernateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activityTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const pumpScareCloseRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotationIndexRef = useRef(0)

  const spawnHibernatePopup = useCallback((electronAPI: ReturnType<typeof useElectronAPI>) => {
    const pack = usePackStore.getState().pack
    if (!pack) return

    const pool = [...pack.media.images, ...pack.media.videos]
    const audioPool = pack.media.audio
    if (pool.length === 0 && audioPool.length === 0) return

    const path = pool.length > 0 ? pickRandom(pool) : pickRandom(audioPool)
    const isVideo = pool.length > 0 && pack.media.videos.includes(path)
    const isAudio = audioPool.includes(path)

    if (isAudio) {
      const id = audioIdCounter++
      usePopupStore.getState().addPopup({
        id, type: 'audio', mediaPath: path, x: 0, y: 0, width: 0, height: 0,
        moving: false, dx: 0, dy: 0, mitosisSpawned: true, spawnTime: Date.now(),
      })
      return
    }

    const cfg = useConfigStore.getState()
    const scale = cfg.popupScale || 1
    const w = Math.round(randomInt(200, 400) * scale)
    const h = Math.round(randomInt(150, 300) * scale)
    const bounds = screenRef.current
    const occupied: OccupiedZone[] = usePopupStore.getState().popups
    const { x, y } = computeSpawnPosition(w, h, bounds, occupied)

    if (electronAPI) {
      const mediaExt = extOf(path)
      const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
      const hypnoMediaPath = isStaticImage && roll(cfg.subliminalsChance) && pack.media.hypno.length > 0
        ? pickRandom(pack.media.hypno)
        : undefined

      electronAPI.createPopup({
        mediaPath: path,
        type: isVideo ? 'video' : 'image',
        width: w, height: h, x, y,
        opacity: 100,
        clickthrough: cfg.clickthroughPopups,
        clicksToClose: cfg.buttonless ? 999 : 1,
        popupClose: usePackStore.getState().getPopupCloseText(),
        buttonless: cfg.buttonless,
        denialFilter: roll(cfg.denialChance) ? pickDenialFilter() : undefined,
        hypnoMediaPath,
        hypnoOpacity: cfg.subliminalsAlpha,
      }).then((popupId) => {
        const dir = randomDirection()
        const moving = shouldMove(cfg.movingChance)
        usePopupStore.getState().addPopup({
          id: popupId, type: isVideo ? 'video' : 'image',
          x, y, width: w, height: h,
          moving,
          dx: dir.dx, dy: dir.dy,
          mitosisSpawned: true,
          spawnTime: Date.now(),
        })
      }).catch((err) => {
        console.error('hibernate:createPopup failed', err)
      })
    }
  }, [])

  const cancelHibernateTimers = useCallback(() => {
    if (hibernateTimerRef.current) {
      clearTimeout(hibernateTimerRef.current)
      hibernateTimerRef.current = null
    }
    for (const t of activityTimerRefs.current) clearTimeout(t)
    activityTimerRefs.current = []
    for (const t of pumpScareCloseRefs.current) clearTimeout(t)
    pumpScareCloseRefs.current = []
  }, [])

  const runHibernateActivity = useCallback((electronAPI: ReturnType<typeof useElectronAPI>) => {
    const cfg = useConfigStore.getState()
    const hType = cfg.hibernateType as HibernateType
    const hLength = cfg.hibernateLength
    const wakeup = cfg.wakeupActivity

    const schedule = planActivity(hType, hLength, wakeup)
    useHibernateStore.getState().activate(hType)

    for (const tick of schedule) {
      const timer = setTimeout(() => {
        if (useAppStore.getState().inPanicMode) return

        if (hType === 'Pump-Scare') {
          // Spawn one image and one audio popup
          const pack = usePackStore.getState().pack
          if (pack) {
            if (pack.media.images.length > 0) {
              const imgPath = pickRandom(pack.media.images)
              const cfgLocal = useConfigStore.getState()
              const scale = cfgLocal.popupScale || 1
              const w = Math.round(randomInt(200, 400) * scale)
              const h = Math.round(randomInt(150, 300) * scale)
              const bounds = screenRef.current
              const occupiedPump: OccupiedZone[] = usePopupStore.getState().popups
              const { x, y } = computeSpawnPosition(w, h, bounds, occupiedPump)

              if (electronAPI) {
                electronAPI.createPopup({
                  mediaPath: imgPath, type: 'image',
                  width: w, height: h, x, y,
                  opacity: 100,
                  clickthrough: cfgLocal.clickthroughPopups,
                  clicksToClose: cfgLocal.buttonless ? 999 : 1,
                  popupClose: usePackStore.getState().getPopupCloseText(),
                  buttonless: cfgLocal.buttonless,
                  denialFilter: roll(cfgLocal.denialChance) ? pickDenialFilter() : undefined,
                  hypnoMediaPath: undefined,
                  hypnoOpacity: 0,
                }).then((popupId) => {
                  usePopupStore.getState().addPopup({
                    id: popupId, type: 'image',
                    x, y, width: w, height: h,
                    moving: false, dx: 0, dy: 0,
                    mitosisSpawned: true,
                    spawnTime: Date.now(),
                  })
                  // FUTUREWORK: Make pump-scare auto-close duration configurable
                  const autoCloseTimer = setTimeout(() => {
                    electronAPI.closePopup(popupId).catch(() => {})
                    usePopupStore.getState().removePopup(popupId)
                  }, 2500)
                  pumpScareCloseRefs.current.push(autoCloseTimer)
                }).catch((err) => console.error('pump-scare:createPopup image failed', err))
              }
            }
            if (pack.media.audio.length > 0) {
              const audioPath = pickRandom(pack.media.audio)
              const audioId = audioIdCounter++
              usePopupStore.getState().addPopup({
                id: audioId, type: 'audio', mediaPath: audioPath,
                x: 0, y: 0, width: 0, height: 0,
                moving: false, dx: 0, dy: 0,
                mitosisSpawned: true,
                spawnTime: Date.now(),
              })
            }
          }
        } else {
          spawnHibernatePopup(electronAPI)
        }
      }, tick.delay)

      activityTimerRefs.current.push(timer)
    }

    // Schedule deactivation after all ticks have fired
    const totalDuration = schedule.length > 0
      ? Math.max(...schedule.map((t) => t.delay)) + 100
      : 0

    const deactivateTimer = setTimeout(() => {
      useHibernateStore.getState().deactivate()

      // Check wallpaper reset
      const cfgNow = useConfigStore.getState()
      if (shouldResetWallpaper(cfgNow.fixWallpaper, usePopupStore.getState().popupCount, false)) {
        const pack = usePackStore.getState().pack
        if (pack && electronAPI) {
          electronAPI.setWallpaper(pack.media.images[0] || '')
        }
      }

      // Start next sleep cycle if still running
      if (useAppStore.getState().running && !useAppStore.getState().inPanicMode) {
        scheduleNextHibernateSleep(electronAPI)
      }
    }, totalDuration)

    activityTimerRefs.current.push(deactivateTimer)
  }, [spawnHibernatePopup])

  const scheduleNextHibernateSleep = useCallback((electronAPI: ReturnType<typeof useElectronAPI>) => {
    const cfg = useConfigStore.getState()
    if (!cfg.hibernateMode) return

    cancelHibernateTimers()

    const delayMs = hibernateDelay(cfg.hibernateMin, cfg.hibernateMax)

    hibernateTimerRef.current = setTimeout(() => {
      if (useAppStore.getState().inPanicMode) return
      runHibernateActivity(electronAPI)
    }, delayMs)
  }, [cancelHibernateTimers, runHibernateActivity])

  useEffect(() => {
    if (!running || !electronAPI) {
      cancelHibernateTimers()
      return
    }

    const cfg = useConfigStore.getState()

    if (cfg.hibernateMode && usePopupStore.getState().popupCount === 0) {
      scheduleNextHibernateSleep(electronAPI)
    }

    return () => {
      cancelHibernateTimers()
    }
  }, [running, electronAPI, scheduleNextHibernateSleep, cancelHibernateTimers])

  // Listen for "Skip to Hibernate" tray action
  useEffect(() => {
    if (!electronAPI) return
    electronAPI.onHibernateSkip(() => {
      if (useAppStore.getState().inPanicMode) return
      if (!useConfigStore.getState().hibernateMode) return
      cancelHibernateTimers()
      runHibernateActivity(electronAPI)
    })
  }, [electronAPI, cancelHibernateTimers, runHibernateActivity])

  // Reactive wallpaper reset — when popup count drops to 0 and hibernate is not
  // active, restore the wallpaper if fixWallpaper is enabled. This mirrors the
  // Python Subject/Observer pattern on popup_number.
  const prevPopupCountRef = useRef(popupCount)
  useEffect(() => {
    const prevCount = prevPopupCountRef.current
    prevPopupCountRef.current = popupCount

    if (popupCount > prevCount || popupCount !== 0) return
    if (!electronAPI) return

    const cfg = useConfigStore.getState()
    if (!shouldResetWallpaper(cfg.fixWallpaper, popupCount, useHibernateStore.getState().active)) return

    const pack = usePackStore.getState().pack
    if (pack) {
      electronAPI.setWallpaper(pack.media.images[0] || '')
    }
  }, [popupCount, electronAPI])

  // --- Wallpaper rotation timer ---
  // When rotateWallpaper is enabled and a pack with multiple images is loaded,
  // cycle wallpapers at a configurable interval with random variance. Uses
  // recursive setTimeout (not setInterval) so each tick computes its own delay.
  // Stops when panic mode activates or rotation is disabled via config.
  useEffect(() => {
    const cancelRotation = () => {
      if (rotationTimerRef.current) {
        clearTimeout(rotationTimerRef.current)
        rotationTimerRef.current = null
      }
    }

    if (!running || !electronAPI || inPanicMode) {
      cancelRotation()
      return
    }

    const cfg = useConfigStore.getState()
    const pack = usePackStore.getState().pack
    const wallpaperCount = pack ? pack.media.images.length : 0

    if (!shouldRotate(cfg.rotateWallpaper, wallpaperCount)) {
      cancelRotation()
      return
    }

    const scheduleNext = () => {
      const currentCfg = useConfigStore.getState()
      const currentPack = usePackStore.getState().pack
      const count = currentPack ? currentPack.media.images.length : 0

      const schedule = computeRotation(
        {
          currentIndex: rotationIndexRef.current,
          enabled: currentCfg.rotateWallpaper,
          interval: currentCfg.wallpaperTimer,
          variance: currentCfg.wallpaperVariance,
        },
        count,
      )
      if (!schedule) return

      rotationTimerRef.current = setTimeout(() => {
        if (useAppStore.getState().inPanicMode) return

        rotationIndexRef.current = schedule.nextIndex
        const latestPack = usePackStore.getState().pack
        if (latestPack) {
          const wallpaperPath = latestPack.media.images[schedule.nextIndex]
          if (wallpaperPath) {
            electronAPI.setWallpaper(wallpaperPath)
          }
        }

        scheduleNext()
      }, schedule.intervalMs)
    }

    scheduleNext()

    return cancelRotation
  }, [running, electronAPI, inPanicMode])

  const handleSplashComplete = useCallback(() => {
    completeSplash()
  }, [completeSplash])

  if (inPanicMode) {
    return (
      <Container size="xs" py="xl" ta="center">
        <Title order={2} c="red">PANIC MODE</Title>
        <Text c="dimmed" mt="md">
          All popups have been closed.
          {isLockedOut
            ? 'Enter the safeword or press "Clear Panic" in the config panel to resume.'
            : 'Press "Clear Panic" in the config panel to resume.'}
        </Text>
        <SafewordModal />
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
      <SafewordModal />
      <PopupContainer />
    </>
  )
}
