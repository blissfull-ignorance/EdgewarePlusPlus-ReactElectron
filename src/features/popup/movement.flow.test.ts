import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePopupStore } from '@/stores/popupStore'
import { useAppStore } from '@/stores/appStore'
import { shouldMove, randomDirection, tickPopups } from './movement'
import type { TickablePopup, ScreenBounds } from './movement'

const screen: ScreenBounds = { width: 1920, height: 1080 }

/** Reset all stores to clean state between tests. */
function resetAll() {
  usePopupStore.getState().clearPopups()
  useAppStore.getState().clearPanic()
  useAppStore.getState().setRunning(false)
  useConfigStore.getState().updateConfig({
    movingChance: 100,
    movingSpeed: 5,
    maxVideos: 10,
    popupScale: 1,
    denialChance: 0,
    subliminalsChance: 0,
    subliminalsAlpha: 20,
    buttonless: false,
    clickthroughPopups: false,
  })
}

/** Simulates a single spawn tick: reads config, decides moving flag, adds popup. */
function simulateSpawnTick() {
  const cfg = useConfigStore.getState()
  const popup = usePopupStore.getState()
  if (popup.popupCount >= cfg.maxVideos) return

  const w = 300
  const h = 200
  const x = 500
  const y = 400

  const dir = randomDirection(() => 0.25)
  const moving = shouldMove(cfg.movingChance)

  usePopupStore.getState().addPopup({
    id: popup.popupCount + 1,
    type: 'image',
    x, y, width: w, height: h,
    moving,
    dx: dir.dx, dy: dir.dy,
    mitosisSpawned: false,
  })
}

/** Simulates a single movement tick: reads store popups, applies tickPopups, writes back. */
function simulateMoveTick() {
  const cfg = useConfigStore.getState()
  const popups = usePopupStore.getState().popups as TickablePopup[]
  const updates = tickPopups(popups, cfg.movingSpeed, screen)
  for (const [id, update] of updates) {
    usePopupStore.getState().updatePopup(id, update)
  }
  return updates
}

/**
 * End-to-end flow tests — verify the full pipeline from config → spawn → move tick.
 * These catch integration issues where individual functions work in isolation
 * but break when composed through the store layer.
 */
describe('full flow simulation — config → spawn → move tick', () => {
  beforeEach(() => {
    resetAll()
  })

  it('spawn with movingChance=100 → popup has moving=true', () => {
    simulateSpawnTick()
    const popups = usePopupStore.getState().popups
    expect(popups.length).toBe(1)
    expect(popups[0].moving).toBe(true)
  })

  it('spawn with movingChance=0 → popup has moving=false', () => {
    useConfigStore.getState().updateConfig({ movingChance: 0 })
    simulateSpawnTick()
    const popups = usePopupStore.getState().popups
    expect(popups.length).toBe(1)
    expect(popups[0].moving).toBe(false)
  })

  it('moving popup changes position after one move tick', () => {
    simulateSpawnTick()
    const before = usePopupStore.getState().popups[0]
    const { x: bx, y: by } = before

    simulateMoveTick()

    const after = usePopupStore.getState().popups[0]
    const moved = Math.abs(after.x - bx) + Math.abs(after.y - by)
    expect(moved).toBeGreaterThan(0)
  })

  it('non-moving popup does NOT change position', () => {
    useConfigStore.getState().updateConfig({ movingChance: 0 })
    simulateSpawnTick()
    const before = usePopupStore.getState().popups[0].x

    simulateMoveTick()

    const after = usePopupStore.getState().popups[0]
    expect(after.x).toBe(before)
  })

  it('50 move ticks: popup accumulates significant displacement', () => {
    simulateSpawnTick()
    const startX = usePopupStore.getState().popups[0].x

    for (let i = 0; i < 50; i++) {
      simulateMoveTick()
    }

    const final = usePopupStore.getState().popups[0]
    const totalDisplacement = Math.abs(final.x - startX) + Math.abs(final.y - 400)
    expect(totalDisplacement).toBeGreaterThan(50)
  })

  it('full cycle: spawn 3 popups, all moving, all move', () => {
    simulateSpawnTick()
    simulateSpawnTick()
    simulateSpawnTick()

    const beforePositions = usePopupStore.getState().popups.map((p) => ({ x: p.x, y: p.y }))

    for (let i = 0; i < 10; i++) {
      simulateMoveTick()
    }

    const afterPopups = usePopupStore.getState().popups
    expect(afterPopups.length).toBe(3)
    for (let i = 0; i < 3; i++) {
      const dx = Math.abs(afterPopups[i].x - beforePositions[i].x)
      const dy = Math.abs(afterPopups[i].y - beforePositions[i].y)
      expect(dx + dy).toBeGreaterThan(0)
    }
  })

  it('speed=0 → no movement even with moving=true', () => {
    useConfigStore.getState().updateConfig({ movingSpeed: 0 })
    simulateSpawnTick()

    for (let i = 0; i < 50; i++) {
      simulateMoveTick()
    }

    const final = usePopupStore.getState().popups[0]
    expect(final.x).toBe(500)
  })

  it('explicitly set movingChance=100 produces moving popups', () => {
    const freshConfig = useConfigStore.getState()
    expect(freshConfig.movingChance).toBe(100)

    useConfigStore.getState().updateConfig({ movingChance: freshConfig.movingChance })
    simulateSpawnTick()
    const popups = usePopupStore.getState().popups
    expect(popups[0].moving).toBe(true)
  })
})

/**
 * Popup removal mid-simulation tests.
 *
 * These verify that the movement tick loop handles popups being removed
 * between ticks — the exact scenario that occurs during mitosis close flow
 * (onPopupClosed → removePopup → spawnMitosisPopup). The tick loop must
 * not crash or produce stale references when the popup list changes.
 */
describe('popup removal mid-simulation — mitosis close flow', () => {
  beforeEach(() => {
    resetAll()
  })

  it('removing a popup mid-tick does not affect remaining popups', () => {
    simulateSpawnTick()
    simulateSpawnTick()
    simulateSpawnTick()
    expect(usePopupStore.getState().popups).toHaveLength(3)

    // Remove popup 2 mid-simulation (simulates mitosis close)
    usePopupStore.getState().removePopup(2)
    expect(usePopupStore.getState().popups).toHaveLength(2)

    // Movement tick should still process remaining popups correctly
    simulateMoveTick()
    expect(usePopupStore.getState().popups).toHaveLength(2)
    // Remaining popups (1 and 3) should still exist
    const remaining = usePopupStore.getState().popups
    expect(remaining.find((p) => p.id === 1)).toBeDefined()
    expect(remaining.find((p) => p.id === 3)).toBeDefined()
    expect(remaining.find((p) => p.id === 2)).toBeUndefined()
  })

  it('removing all popups mid-simulation produces empty tick', () => {
    simulateSpawnTick()
    simulateSpawnTick()
    expect(usePopupStore.getState().popups).toHaveLength(2)

    usePopupStore.getState().clearPopups()
    expect(usePopupStore.getState().popups).toHaveLength(0)

    // Tick on empty store should not crash
    const popups = usePopupStore.getState().popups as TickablePopup[]
    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(0)
  })

  it('removing the only popup mid-simulation leaves empty state', () => {
    simulateSpawnTick()
    expect(usePopupStore.getState().popups).toHaveLength(1)

    usePopupStore.getState().removePopup(1)
    expect(usePopupStore.getState().popups).toHaveLength(0)
    expect(usePopupStore.getState().popupCount).toBe(0)

    // Subsequent tick should be harmless
    const popups = usePopupStore.getState().popups as TickablePopup[]
    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(0)
  })

  it('simulated mitosis: remove original, spawn replacement, continue moving', () => {
    // Spawn 2 popups
    simulateSpawnTick()
    simulateSpawnTick()
    const initial = usePopupStore.getState().popups
    expect(initial).toHaveLength(2)

    // Simulate mitosis close: remove popup 1, spawn replacement with new id
    usePopupStore.getState().removePopup(1)
    usePopupStore.getState().addPopup({
      id: 100, type: 'image', x: 600, y: 300, width: 300, height: 200,
      moving: true, dx: 1, dy: 0, mitosisSpawned: true,
    })
    expect(usePopupStore.getState().popups).toHaveLength(2)

    // Move tick should process both remaining popups
    const updates = simulateMoveTick()
    expect(updates.size).toBe(2)
    expect(updates.has(2)).toBe(true)
    expect(updates.has(100)).toBe(true)
  })

  it('multiple rapid removals: store stays consistent', () => {
    for (let i = 0; i < 10; i++) {
      simulateSpawnTick()
    }
    expect(usePopupStore.getState().popups).toHaveLength(10)

    // Remove 5 popups in rapid succession
    for (let i = 1; i <= 5; i++) {
      usePopupStore.getState().removePopup(i)
    }
    expect(usePopupStore.getState().popups).toHaveLength(5)
    expect(usePopupStore.getState().popupCount).toBe(5)

    // Remaining 5 should all move correctly
    const popups = usePopupStore.getState().popups as TickablePopup[]
    const moving = popups.filter((p) => p.moving)
    expect(moving.length).toBeGreaterThan(0)
  })
})

/**
 * Stress tests for rapid add/remove cycles.
 *
 * These verify that the popup store and movement system remain consistent
 * under rapid state changes — e.g., spawning and immediately removing
 * popups in quick succession, which can occur during high-frequency
 * mitosis events or panic mode.
 */
describe('stress tests — rapid add/remove cycles', () => {
  beforeEach(() => {
    resetAll()
  })

  it('rapid add then immediate remove: count stays consistent', () => {
    for (let i = 0; i < 50; i++) {
      usePopupStore.getState().addPopup({
        id: i + 1, type: 'image', x: 100, y: 100, width: 300, height: 200,
        moving: false, dx: 0, dy: 0, mitosisSpawned: false,
      })
      usePopupStore.getState().removePopup(i + 1)
    }
    const state = usePopupStore.getState()
    expect(state.popups).toHaveLength(0)
    expect(state.popupCount).toBe(0)
  })

  it('interleaved add/remove: final count matches net operations', () => {
    // Add 20, remove 5, add 3, remove 2 → net 16
    for (let i = 0; i < 20; i++) {
      usePopupStore.getState().addPopup({
        id: i + 1, type: 'image', x: 100, y: 100, width: 300, height: 200,
        moving: false, dx: 0, dy: 0, mitosisSpawned: false,
      })
    }
    for (let i = 1; i <= 5; i++) {
      usePopupStore.getState().removePopup(i)
    }
    for (let i = 21; i <= 23; i++) {
      usePopupStore.getState().addPopup({
        id: i, type: 'image', x: 100, y: 100, width: 300, height: 200,
        moving: false, dx: 0, dy: 0, mitosisSpawned: false,
      })
    }
    usePopupStore.getState().removePopup(6)
    usePopupStore.getState().removePopup(7)

    const state = usePopupStore.getState()
    expect(state.popups).toHaveLength(16)
    expect(state.popupCount).toBe(16)
  })

  it('tickPopups on rapidly modified list does not crash', () => {
    // Add 20 popups, remove half, tick the remainder
    for (let i = 0; i < 20; i++) {
      usePopupStore.getState().addPopup({
        id: i + 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
        moving: true, dx: 1, dy: 0, mitosisSpawned: false,
      })
    }
    for (let i = 1; i <= 10; i++) {
      usePopupStore.getState().removePopup(i)
    }

    const popups = usePopupStore.getState().popups as TickablePopup[]
    expect(popups).toHaveLength(10)
    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(10)
  })

  it('clearPopups during active movement: tick on empty list is safe', () => {
    for (let i = 0; i < 10; i++) {
      simulateSpawnTick()
    }
    // Panic mode: clear all
    usePopupStore.getState().clearPopups()

    const popups = usePopupStore.getState().popups as TickablePopup[]
    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(0)
    expect(usePopupStore.getState().popupCount).toBe(0)
  })
})
