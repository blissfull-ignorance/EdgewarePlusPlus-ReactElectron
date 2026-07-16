import { describe, it, expect, beforeEach } from 'vitest'
import { useCorruptionStore } from './corruptionStore'

beforeEach(() => {
  useCorruptionStore.setState({
    enabled: false,
    level: 1,
    maxLevel: 10,
    activeMoods: [],
    configOverrides: {},
    triggerType: 'Timed',
    fadeType: 'Normal',
    corruptionTimeStart: 0,
    corruptionPopupCount: 0,
    corruptionLaunchCount: 1,
    fadeProgress: 0,
    corruptionLevels: [],
    baseMoods: [],
    initialized: false,
  })
})

describe('corruptionStore', () => {
  describe('applyLevelEffects', () => {
    it('sets initialized=true even with empty corruptionLevels', () => {
      useCorruptionStore.getState().applyLevelEffects()
      expect(useCorruptionStore.getState().initialized).toBe(true)
    })

    it('does not change activeMoods with empty corruptionLevels', () => {
      useCorruptionStore.getState().applyLevelEffects()
      expect(useCorruptionStore.getState().activeMoods).toEqual([])
    })

    it('does not change configOverrides with empty corruptionLevels', () => {
      useCorruptionStore.getState().applyLevelEffects()
      expect(useCorruptionStore.getState().configOverrides).toEqual({})
    })

    it('resolves moods and overrides with non-empty levels', () => {
      useCorruptionStore.setState({
        corruptionLevels: [
          { addedMoods: ['furry'], removedMoods: [], wallpaper: null, config: { promptMod: 5 } },
          { addedMoods: ['goon'], removedMoods: ['furry'], wallpaper: null, config: { denialChance: 20 } },
        ],
        baseMoods: ['hypno'],
        level: 2,
      })
      useCorruptionStore.getState().applyLevelEffects()

      const state = useCorruptionStore.getState()
      expect(state.initialized).toBe(true)
      expect(state.activeMoods).toEqual(expect.arrayContaining(['hypno', 'goon']))
      expect(state.activeMoods).not.toContain('furry')
      expect(state.configOverrides).toEqual({ promptMod: 5, denialChance: 20 })
    })
  })

  describe('advanceLevel', () => {
    it('increments level from 1 to 2', () => {
      useCorruptionStore.setState({
        maxLevel: 10,
        corruptionLevels: [
          { addedMoods: ['a'], removedMoods: [], wallpaper: null, config: {} },
          { addedMoods: ['b'], removedMoods: [], wallpaper: null, config: {} },
        ],
      })
      useCorruptionStore.getState().advanceLevel()
      expect(useCorruptionStore.getState().level).toBe(2)
    })

    it('increments past 1 with multiple advances', () => {
      useCorruptionStore.setState({
        maxLevel: 5,
        corruptionLevels: [
          { addedMoods: ['a'], removedMoods: [], wallpaper: null, config: {} },
          { addedMoods: ['b'], removedMoods: [], wallpaper: null, config: {} },
          { addedMoods: ['c'], removedMoods: [], wallpaper: null, config: {} },
        ],
      })
      useCorruptionStore.getState().advanceLevel()
      useCorruptionStore.getState().advanceLevel()
      expect(useCorruptionStore.getState().level).toBe(3)
    })

    it('clamps at maxLevel', () => {
      useCorruptionStore.setState({
        level: 5,
        maxLevel: 5,
        corruptionLevels: [
          { addedMoods: [], removedMoods: [], wallpaper: null, config: {} },
        ],
      })
      useCorruptionStore.getState().advanceLevel()
      expect(useCorruptionStore.getState().level).toBe(5)
    })

    it('sets initialized after advance', () => {
      useCorruptionStore.setState({
        corruptionLevels: [
          { addedMoods: [], removedMoods: [], wallpaper: null, config: {} },
        ],
      })
      useCorruptionStore.getState().advanceLevel()
      expect(useCorruptionStore.getState().initialized).toBe(true)
    })
  })

  describe('disable', () => {
    it('resets initialized to false', () => {
      useCorruptionStore.setState({ initialized: true })
      useCorruptionStore.getState().disable()
      expect(useCorruptionStore.getState().initialized).toBe(false)
    })

    it('clears activeMoods and configOverrides', () => {
      useCorruptionStore.setState({
        activeMoods: ['furry'],
        configOverrides: { promptMod: 5 },
      })
      useCorruptionStore.getState().disable()
      const state = useCorruptionStore.getState()
      expect(state.activeMoods).toEqual([])
      expect(state.configOverrides).toEqual({})
    })
  })
})
