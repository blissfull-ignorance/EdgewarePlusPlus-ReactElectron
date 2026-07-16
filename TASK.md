# TASK — Implement Single Mode Weighted Random Spawn Selection

## Problem

The `singleMode` config option exists (`configStore.ts:92`) and is exposed in the Config Panel UI (`ConfigPanel.tsx:453`), but the spawn tick in `App.tsx` ignores it entirely. When `singleMode` is enabled, the Python original (`roll.py:roll_targets`) selects **one** media type via `random.choices` weighted by the type's chance value (`popupMod`, `vidMod`, `audioMod`), then spawns that type only. Currently the TS spawn tick always spawns independently — audio alongside visual — regardless of `singleMode`.

## Reference: Python Original

From `edgeware/src/roll.py:36-44`:

```python
def roll_targets(settings, targets):
    if settings.single_mode:
        function = random.choices(
            list(map(lambda t: t.function, targets)),
            list(map(lambda t: t.chance(), targets)),
            k=1
        )[0]
        function()
    else:
        for target in targets:
            target.roll()
```

In single mode: one type chosen by weighted random, only that type spawns. In normal mode: each type rolled independently (current TS behavior).

## Steps

### 1. Add `pickSingleType` pure function to `src/features/popup/spawn.ts`

- New function: `pickSingleType(chances: { images: number; videos: number; audio: number }, randomFn?: () => number): 'images' | 'videos' | 'audio' | null`
- Uses `random.choices` equivalent: weighted random selection among types with `chance > 0`
- Returns `null` if all chances are 0
- Pure function, injectable `randomFn` for testing

### 2. Modify spawn tick in `src/App.tsx`

- After `computeSpawnPools`, check `cfg.singleMode`
- If `singleMode` is true, call `pickSingleType` with `{ images: cfg.popupMod, videos: cfg.vidMod, audio: cfg.audioMod }`
- Only spawn the selected type (skip audio if type is not `'audio'`, skip visual if type is `'images'` or `'videos'`)
- If `singleMode` is false, keep existing independent-spawn behavior unchanged

### 3. Add tests in `src/features/popup/spawn.test.ts`

- `pickSingleType` returns the type with non-zero chance when only one has chance > 0
- `pickSingleType` selects among multiple types proportional to chances (use deterministic random)
- `pickSingleType` returns `null` when all chances are 0
- Integration test: when `singleMode` is true, only one type spawns per tick (mock `random.choices`)
- Regression: when `singleMode` is false, existing independent behavior is preserved

### 4. Run verification

```bash
npm run check
npm run lint
npm run test
```

### 5. Improve comments/documentation where appropriate.

### 6. Commit all changes with a meaningful commit message.

### 7. Update HANDOVER.md to describe the current project state and recommend the next highest-priority task.
