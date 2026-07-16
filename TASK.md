# TASK — Fix Audio Popup Spawn Coupling Bug

## Problem

Audio popup chance is incorrectly coupled to image/video popup chance. In the Python original (`edgeware/src/roll.py`), **every type is rolled independently** — audio, images, and videos can all spawn on the same tick. In the TypeScript port, audio is gated on visual eligibility (`hasVisual && audioMod > 0 && roll(audioMod)`) and competes with visual popups for a single spawn slot per tick.

This means:
- If `popupMod=0` and `vidMod=0`, audio can **never** spawn (even with `audioMod=100`)
- Audio never spawns alongside an image/video — it's one-or-the-other

## Root Cause

1. **`src/features/popup/spawn.ts:59`** — `hasVisual &&` guard on audio eligibility
2. **`src/App.tsx:319-322`** — audio and visual compete in a single-selection ternary

## Steps

### 1. Fix audio eligibility in `src/features/popup/spawn.ts`
- Remove the `hasVisual &&` guard from the `eligibleAudio` computation (line 59)
- Audio should be eligible whenever `audioMod > 0 && roll(audioMod)`, regardless of visual pool

### 2. Fix spawn selection in `src/App.tsx`
- Change the single-selection model so audio spawns independently alongside visual
- The spawn tick should produce: optional visual popup + optional audio, not one-or-the-other
- Audio should NOT consume the visual spawn slot

### 3. Update tests in `src/features/popup/spawn.test.ts`
- Fix "audio not eligible when no visual media is eligible" — audio **should** be eligible independently
- Fix "audio fallback works when hasVisual is false" — audio should spawn regardless of visual state
- Add tests: audio+visual spawn on same tick, audio alone, visual alone, neither

### 4. Cross-check `src/features/popup/AudioPopup.test.ts`
- This file already has a `shouldSpawnAudio` helper with the correct model — verify consistency

### 5. Update `FEATURE_PARITY_AUDIT.md` section 3.6
- Mark audio independence as implemented after fix

### 6. Run verification
```bash
npm run check
npm run lint
npm run test
```

### 7. Improve comments/documentation where appropriate.

### 8. Commit all changes with a meaningful commit message.

### 9. Update HANDOVER.md to describe the current project state and recommend the next highest-priority task.
