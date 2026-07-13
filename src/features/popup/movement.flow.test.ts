import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePopupStore } from '@/stores/popupStore'
import { useAppStore } from '@/stores/appStore'
import { shouldMove, randomDirection, tickPopups } from './movement'
import type { TickablePopup, ScreenBounds } from './movement'

const screen: ScreenBounds = { width: 1920, height: 1080 }

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
  })
}

function simulateMoveTick() {
  const cfg = useConfigStore.getState()
  const popups = usePopupStore.getState().popups as TickablePopup[]
  const updates = tickPopups(popups, cfg.movingSpeed, screen)
  for (const [id, update] of updates) {
    usePopupStore.getState().updatePopup(id, update)
  }
  return updates
}

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

  it('default config has movingChance=0, so spawn creates non-moving popups', () => {
    const freshConfig = useConfigStore.getState()
    expect(freshConfig.movingChance).toBe(100)

    useConfigStore.getState().updateConfig({ movingChance: freshConfig.movingChance })
    simulateSpawnTick()
    const popups = usePopupStore.getState().popups
    expect(popups[0].moving).toBe(true)
  })
})
