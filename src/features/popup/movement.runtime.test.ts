import { describe, it, expect, beforeEach } from 'vitest'
import { usePopupStore } from '@/stores/popupStore'
import { tickPopups } from './movement'
import type { TickablePopup, ScreenBounds } from './movement'

const screen: ScreenBounds = { width: 1920, height: 1080 }

function resetStores() {
  usePopupStore.getState().clearPopups()
}

describe('runtime movement — store integration', () => {
  beforeEach(() => {
    resetStores()
  })

  it('moving popup changes position after tickPopups + store update', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: true, dx: 1, dy: 0,
    })

    const popups = usePopupStore.getState().popups as TickablePopup[]
    expect(popups[0].x).toBe(500)
    expect(popups[0].moving).toBe(true)

    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(1)

    const u = updates.get(1)!
    usePopupStore.getState().updatePopup(1, u)

    const after = usePopupStore.getState().popups
    expect(after[0].x).toBe(505)
    expect(after[0].dx).toBe(1)
  })

  it('stationary popup does NOT change position', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: false, dx: 1, dy: 0,
    })

    const popups = usePopupStore.getState().popups as TickablePopup[]
    const updates = tickPopups(popups, 5, screen)
    expect(updates.size).toBe(0)

    const after = usePopupStore.getState().popups
    expect(after[0].x).toBe(500)
    expect(after[0].moving).toBe(false)
  })

  it('multi-tick simulation: position accumulates correctly', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: true, dx: 1, dy: 0,
    })

    for (let tick = 0; tick < 20; tick++) {
      const popups = usePopupStore.getState().popups as TickablePopup[]
      const updates = tickPopups(popups, 5, screen)
      for (const [id, update] of updates) {
        usePopupStore.getState().updatePopup(id, update)
      }
    }

    const after = usePopupStore.getState().popups
    expect(after[0].x).toBe(500 + 20 * 5)
    expect(after[0].dx).toBe(1)
  })

  it('mixed moving/stationary popups: only moving one changes', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: true, dx: 1, dy: 0,
    })
    usePopupStore.getState().addPopup({
      id: 2, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: false, dx: 1, dy: 0,
    })

    for (let tick = 0; tick < 10; tick++) {
      const popups = usePopupStore.getState().popups as TickablePopup[]
      const updates = tickPopups(popups, 5, screen)
      for (const [id, update] of updates) {
        usePopupStore.getState().updatePopup(id, update)
      }
    }

    const after = usePopupStore.getState().popups
    const p1 = after.find((p) => p.id === 1)!
    const p2 = after.find((p) => p.id === 2)!
    expect(p1.x).toBe(500 + 10 * 5)
    expect(p2.x).toBe(500)
  })

  it('moving popup bounces off right edge and reverses', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: screen.width - 300 - 2, y: 400, width: 300, height: 200,
      moving: true, dx: 1, dy: 0,
    })

    const popups = usePopupStore.getState().popups as TickablePopup[]
    const updates = tickPopups(popups, 10, screen)
    const u = updates.get(1)!
    usePopupStore.getState().updatePopup(1, u)

    const after = usePopupStore.getState().popups
    expect(after[0].x).toBe(screen.width - 300)
    expect(after[0].dx).toBe(-1)
  })

  it('speed=0 produces no movement at all', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 500, y: 400, width: 300, height: 200,
      moving: true, dx: 1, dy: 0,
    })

    for (let tick = 0; tick < 100; tick++) {
      const popups = usePopupStore.getState().popups as TickablePopup[]
      const updates = tickPopups(popups, 0, screen)
      for (const [id, update] of updates) {
        usePopupStore.getState().updatePopup(id, update)
      }
    }

    const after = usePopupStore.getState().popups
    expect(after[0].x).toBe(500)
  })
})
