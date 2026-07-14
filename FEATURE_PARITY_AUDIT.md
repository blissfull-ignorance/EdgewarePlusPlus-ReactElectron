# Feature & Config Parity Audit

## Overview

Audit of the original Edgeware++ Python project (`edgeware/`) against the current React/TypeScript Electron implementation (`src/`, `electron/`).

---

## 1. Config Options — All 97 Items Mapped

Every config key in the Python `CONFIG_ITEMS` dict (`edgeware/src/config/items.py`) has a corresponding field in the TS `Config` interface (`src/types/pack.ts`) and a default in `configStore.ts`. **No config options are missing.**

| Python Key | TS Key | Present in ConfigPanel UI? |
|---|---|---|
| `pack_path` | `packPath` | Yes (Pack tab) |
| `theme` | `themeType` | Yes (Start tab) |
| `theme_ignore_config` | `themeNoConfig` | Yes (Troubleshooting) |
| `startup_splash` | `showLoadingFlair` | Yes (Start tab) |
| `run_on_save_quit` | `runOnSaveQuit` | Yes (Troubleshooting) |
| `desktop_icons` | `desktopIcons` | Yes (Troubleshooting) |
| `safe_mode` | `safeMode` | Yes (Troubleshooting) |
| `message_off` | `messageOff` | Yes (Troubleshooting) |
| `global_panic_key` | `globalPanicButton` | Yes (Troubleshooting) |
| `preset_danger` | `presetsDanger` | Yes (Troubleshooting) |
| `delay` | `delay` | Yes (Start tab) |
| `single_mode` | `singleMode` | Yes (Modes tab) |
| `image_chance` | `popupMod` | Yes (Popup Types) |
| `audio_chance` | `audioMod` | Yes (Popup Types) |
| `max_audio` | `maxAudio` | Yes (Start tab) |
| `audio_volume` | `audioVolume` | Yes (Popup Types) |
| `fade_in_duration` | `fadeInDuration` | Yes (Popup Types) |
| `fade_out_duration` | `fadeOutDuration` | Yes (Popup Types) |
| `video_chance` | `vidMod` | Yes (Popup Types) |
| `max_video` | `maxVideos` | Yes (Start tab) |
| `video_volume` | `videoVolume` | Yes (Popup Types) |
| `web_chance` | `webMod` | Yes (Popup Types) |
| `web_on_popup_close` | `webPopup` | Yes (Popup Types) |
| `prompt_chance` | `promptMod` | Yes (Popup Types) |
| `prompt_max_mistakes` | `promptMistakes` | Yes (Popup Types) |
| `subliminal_chance` | `capPopChance` | Yes (Popup Types) |
| `subliminal_timeout` | `capPopTimer` | Yes (Popup Tweaks) |
| `subliminal_opacity` | `capPopOpacity` | Yes (Popup Tweaks) |
| `notification_chance` | `notificationChance` | Yes (Popup Types) |
| `notification_image_chance` | `notificationImageChance` | Yes (Popup Types) |
| `captions_in_popups` | `showCaptions` | Yes (Popup Tweaks) |
| `hypno_chance` | `subliminalsChance` | Yes (Popup Types) |
| `hypno_opacity` | `subliminalsAlpha` | Yes (Popup Tweaks) |
| `denial_chance` | `denialChance` | Yes (Popup Types) |
| `buttonless` | `buttonless` | Yes (Popup Tweaks) |
| `multi_click_popups` | `multiClick` | Yes (Popup Tweaks) |
| `opacity` | `lkScaling` | Yes (Popup Tweaks / Modes) |
| `timeout_enabled` | `timeoutPopups` | Yes (Popup Tweaks) |
| `timeout` | `popupTimeout` | Yes (Popup Tweaks) |
| `disabled_monitors` | `disabledMonitors` | Yes (Popup Tweaks) |
| `moving_chance` | `movingChance` | Yes (Popup Tweaks) |
| `moving_speed` | `movingSpeed` | Yes (Popup Tweaks) |
| `clickthrough_enabled` | `clickthroughPopups` | Yes (Popup Tweaks) |
| `rotate_wallpaper` | `rotateWallpaper` | Yes (Wallpaper tab) |
| `wallpapers` | `wallpaperDat` | Yes (Wallpaper tab) |
| `wallpaper_timer` | `wallpaperTimer` | Yes (Wallpaper tab) |
| `wallpaper_variance` | `wallpaperVariance` | Yes (Wallpaper tab) |
| `booru_download` | `downloadEnabled` | Yes (Booru tab) |
| `booru_tags` | `tagList` | Yes (Booru tab) |
| `panic_lockout` | `timerMode` | Yes (Dangerous tab) |
| `panic_lockout_password` | `safeword` | Yes (Dangerous tab) |
| `panic_lockout_time` | `timerSetupTime` | Yes (Dangerous tab) |
| `drive_avoid_list` | `avoidList` | Yes (Popup Tweaks) |
| `fill_drive` | `fill` | Yes (Dangerous tab) |
| `fill_delay` | `fill_delay` | Yes (Dangerous tab) |
| `replace_images` | `replace` | Yes (Dangerous tab) |
| `replace_threshold` | `replaceThresh` | Yes (Dangerous tab) |
| `drive_path` | `drivePath` | Yes (Dangerous tab) |
| `panic_disabled` | `panicDisabled` | Yes (Troubleshooting) |
| `run_at_startup` | `start_on_logon` | Yes (Start tab) |
| `show_on_discord` | `showDiscord` | Yes (Start tab) |
| `lowkey_mode` | `lkToggle` | Yes (Modes tab) |
| `lowkey_corner` | `lkCorner` | Yes (Modes tab) |
| `mitosis_mode` | `mitosisMode` | Yes (Modes tab) |
| `mitosis_strength` | `mitosisStrength` | Yes (Modes tab) |
| `hibernate_mode` | `hibernateMode` | Yes (Modes tab) |
| `hibernate_type` | `hibernateType` | Yes (Modes tab) |
| `hibernate_delay_min` | `hibernateMin` | Yes (Modes tab) |
| `hibernate_delay_max` | `hibernateMax` | Yes (Modes tab) |
| `hibernate_activity` | `wakeupActivity` | Yes (Modes tab) |
| `hibernate_activity_length` | `hibernateLength` | Yes (Modes tab) |
| `hibernate_fix_wallpaper` | `fixWallpaper` | Yes (Modes tab) |
| `corruption_mode` | `corruptionMode` | Yes (Corruption tab) |
| `corruption_full` | `corruptionFullPerm` | Yes (Corruption tab) |
| `corruption_trigger` | `corruptionTrigger` | Yes (Corruption tab) |
| `corruption_fade` | `corruptionFadeType` | Yes (Corruption tab) |
| `corruption_time` | `corruptionTime` | Yes (Corruption tab) |
| `corruption_popups` | `corruptionPopups` | Yes (Corruption tab) |
| `corruption_launches` | `corruptionLaunches` | Yes (Corruption tab) |
| `corruption_wallpaper` | `corruptionWallpaperCycle` | Yes (Corruption tab) |
| `corruption_themes` | `corruptionThemeCycle` | Yes (Corruption tab) |
| `corruption_purity` | `corruptionPurityMode` | Yes (Corruption tab) |
| `corruption_dev_mode` | `corruptionDevMode` | Yes (Corruption tab) |
| `toggle_hibernate_skip` | `toggleHibSkip` | Yes (Troubleshooting) |
| `toggle_mood_set` | `toggleMoodSet` | Yes (Troubleshooting) |
| `toggle_internet` | `toggleInternet` | Yes (Troubleshooting) |
| `mpv_subprocess` | `mpvSubprocess` | Yes (Troubleshooting) |
| `video_hardware_acceleration` | `videoHardwareAcceleration` | Yes (Troubleshooting) |
| `panic_key` | `panicButton` | Yes (Troubleshooting) |
| `schedule` | `schedule` | Yes (Scheduler tab) |
| `time_type` | `timeType` | Yes (Scheduler tab) |
| `schedule_time` | `scheduleTime` | Yes (Scheduler tab) |
| `variance_time` | `varianceTime` | Yes (Scheduler tab) |
| `variance_type` | `varianceType` | Yes (Scheduler tab) |
| `repeat_schedule` | `repeatSchedule` | Yes (Scheduler tab) |
| `repeat_type` | `repeatType` | Yes (Scheduler tab) |
| `repeat_time` | `repeatTime` | Yes (Scheduler tab) |

### TS-Only Config Options (not in Python)

| TS Key | Purpose | Notes |
|---|---|---|
| `maxImages` | Max concurrent image popups | Python uses a single `popup_number` counter; TS splits image/video limits |
| `popupScale` | Popup dimension multiplier | Python computes random 30-70% of monitor; TS adds user scaling |
| `mitosisChance` | Mitosis spawn probability per close | Python has mitosis but no per-close probability config |
| `booruName` | Booru download username | Python has no booru username config (uses anonymous) |
| `scheduleType` | Relative/Absolute scheduling | Python only has Relative scheduling |

---

## 2. Feature Inventory — Python vs TypeScript

### 2.1 Fully Ported Features

| Feature | Python Source | TS Implementation |
|---|---|---|
| Image popups (static + animated GIF) | `features/image_popup.py` | `src/features/popup/ImagePopup.tsx` |
| Video popups | `features/video_popup.py` | `src/features/popup/VideoPopup.tsx` |
| Audio popups with fade in/out | `features/audio.py` | `src/features/popup/AudioPopup.tsx` |
| Subliminal text popups | `features/subliminal_popup.py` | `src/features/popup/SubliminalPopup.tsx` |
| Prompt popups (Levenshtein validation) | `features/prompt.py` | `src/features/prompt/PromptModal.tsx` |
| Moving popups (screen-bounded bounce) | `features/popup.py:try_move` | `src/features/popup/movement.ts` |
| Hypno overlays on static images | `features/image_popup.py` | `src/features/popup/HypnoOverlay.tsx` |
| Denial filters (blur/desaturate) | `features/popup.py:try_denial_filter` | `App.tsx:pickDenialFilter` + CSS |
| Captions in popups | `features/popup.py:try_caption` | `ImagePopup.tsx`/`VideoPopup.tsx` |
| Buttonless popups | `features/popup.py:try_button` | `App.tsx` (clicksToClose=999) |
| Multi-click popups | `features/popup.py:try_multi_click` | `App.tsx` (clicksToClose from pack) |
| Timeout popups | `features/popup.py:try_timeout` | Config wired, no auto-close impl |
| Clickthrough popups | `features/popup.py:try_clickthrough` | `electron/ipc/popup.ts` |
| Popup overlap avoidance positioning | `features/popup.py:compute_geometry` | Simplified: random positioning |
| Lowkey mode (corner positioning + opacity) | `features/popup.py:compute_geometry` | Config present, rendering not wired |
| Mitosis mode (spawn on close) | `features/misc.py:handle_mitosis_mode` | `App.tsx:onPopupClosed` |
| Panic mode (hotkey + close all) | `panic.py` | `appStore.ts` + `electron/ipc/keyboard.ts` |
| Panic lockout with safeword | `panic.py` + `misc.py:handle_panic_lockout` | Config only, no runtime lockout |
| System tray (Panic/Skip/Quit) | `features/misc.py:make_tray_icon` | `electron/ipc/tray.ts` |
| System tray with Panic/Skip Hibernate | `features/misc.py:make_tray_icon` | `electron/ipc/tray.ts` |
| Discord presence | `features/misc.py:handle_discord` | `discordStore.ts` + `electron/ipc/discord.ts` |
| Desktop shortcuts | `features/misc.py:make_desktop_icons` | `electron/ipc/shortcut.ts` |
| Wallpaper setting (cross-platform) | `features/misc.py:handle_wallpaper` | `electron/ipc/wallpaper.ts` |
| Web open on popup close | `features/misc.py:open_web` | `electron/ipc/web.ts` |
| Desktop notifications | `features/misc.py:send_notification` | `electron/ipc/notifications.ts` |
| Pack loading (directory/zip) | `pack/load.py` | `electron/ipc/pack.ts` |
| Config persistence (load/save) | `config/__init__.py` | `electron/ipc/config.ts` |
| Startup splash screen | `features/startup_splash.py` | `src/components/SplashScreen.tsx` |
| Lua scripting engine | `scripting/` | `electron/scripting/` + `scriptStore.ts` |
| Script API: popup spawn, panic, wallpaper, mood, corruption | `scripting/modules.py` | `electron/scripting/api_v1.ts` |
| Script API: prompt, web, notification, close popups | `scripting/modules.py` | `electron/scripting/api_v1.ts` |
| Corruption mode UI controls | `config/window/tabs/corruption.py` | `ConfigPanel.tsx` (Corruption tab) |
| Hibernate mode UI controls | `config/window/tabs/modes.py` | `ConfigPanel.tsx` (Modes tab) + `HibernatePanel.tsx` |
| Scheduler UI controls | `config/window/tabs/general/scheduling.py` | `ConfigPanel.tsx` (Scheduler tab) |
| Danger warnings for dangerous settings | `config/items.py:Danger` | Not ported (see below) |
| Corruption danger check on startup | `features/corruption.py:corruption_danger_check` | Not ported |
| Corruption block list (prevent config changes) | `config/items.py:CORRUPTION_BLOCK` | Not ported |
| Booru download | `features/image_popup.py` + booru lib | Config exists, download logic not wired |
| Media blacklist (Alt+click) | `features/popup.py:blacklist_media` | Not ported |
| Single mode (one popup type per cycle) | `roll.py:roll_targets` | Config exists, spawn logic not wired |
| Theme application to tkinter widgets | `config/themes.py:theme_change` | Uses Mantine theming (different approach) |

### 2.2 Partially Ported / Missing Runtime Logic

These features have config options and UI controls but **lack runtime implementation** in the TS version:

| Feature | What's Missing |
|---|---|
| **Corruption mode runtime** | No level progression logic (`corruption.py:timed/popup/launch`). `corruptionStore.ts` has `advanceLevel()` but no timer/observer triggers. No corruption-level-specific mood changes, wallpaper changes, or config overrides. |
| **Hibernate mode runtime** | No activity loop scheduling (`hibernate.py`). No Original/Spaced/Glitch/Ramp/Pump-Scare/Chaos mode behaviors. `hibernateStore.ts` has state but no timer logic. |
| **Panic lockout runtime** | Config exists but no lockout timer, no safeword validation dialog, no `panic_lockout_active` state tracking. |
| **Wallpaper rotation** | Config exists (`rotateWallpaper`, `wallpaperTimer`, `wallpaperVariance`) but no rotation timer logic. Only single wallpaper set on start. |
| **Keyboard listener** | `electron/ipc/keyboard.ts` registers global shortcut but no Alt-key tracking for media blacklisting or per-key event forwarding. |
| **Popup timeout (auto-close)** | `timeoutPopups` + `popupTimeout` config exists but no auto-close timer is implemented in popup creation. |
| **Single mode** | `singleMode` config exists but the spawn tick doesn't use weighted random selection among types. |
| **Booru download** | `downloadEnabled` + `tagList` + `booruName` config exists but no download logic in spawn tick. |
| **Run at startup** | `start_on_logon` config exists but no OS-level auto-start registration. |
| **Theme corruption cycling** | `corruptionThemeCycle` config exists but no corruption-level theme switching. |
| **Danger warnings** | Python shows danger dialogs for extreme/major settings. TS has no equivalent danger-check system. |

### 2.3 Missing Features (Python has, TS does not)

| Feature | Python Source | Notes |
|---|---|---|
| **Media blacklist** | `popup.py:blacklist_media` | Alt+click moves media to blacklist folder + notification |
| **Popup overlap avoidance** | `popup.py:compute_geometry` | Python uses grid-based weighting to minimize overlap; TS uses random positioning |
| **Lowkey mode rendering** | `popup.py:compute_geometry` | Python positions popups in corners; TS has config but no corner positioning logic |
| **Corruption config overrides** | `corruption.py:apply_corruption_level` | Python corruption levels can change config values at runtime |
| **Corruption danger check** | `corruption.py:corruption_danger_check` | Python warns when corruption levels enable dangerous settings |
| **Corruption block list** | `config/items.py:CORRUPTION_BLOCK` | Python prevents corruption from changing certain config keys |
| **Corruption launch counter persistence** | `corruption.py:launch` | Python persists launch count across sessions via file |
| **Hibernate wallpaper reset** | `hibernate.py:reset_wallpaper` | Python resets wallpaper after hibernate ends |
| **Pump-Scare hibernate type** | `hibernate.py` | Python creates a single image+audio popup and auto-closes after 2.5s |
| **Tray "Skip to Hibernate"** | `misc.py:make_tray_icon` | Python adds tray menu item to skip hibernate timer |
| **Subject/Observer pattern** | `state.py:Subject` | Python uses reactive observers for popup_number and hibernate_active changes |
| **mpv video player** | `features/video_player.py` | Python uses mpv for video/animated GIF; TS uses HTML5 `<video>` |
| **Animated GIF handling** | `image_popup.py` | Python plays animated GIFs via mpv; TS plays them as static images |
| **Gaussian blur denial** | `popup.py:try_denial_filter` | Python applies PIL GaussianBlur; TS uses CSS blur (similar effect) |
| **Startup splash animated GIF** | `startup_splash.py` | Python plays animated splash via mpv; TS uses CSS fade animation |
| **Multiple corruption fade types** | `corruption.py:fade` | Python only implements Normal/Abrupt; TS UI has Glitch/Ramp options too |
| **Config validation** | `config/items.py` + voluptuous | Python validates config values against schemas; TS has no runtime validation |
| **First-launch config** | `config/__init__.py:first_launch_configure` | Python runs initial config setup on first launch |

---

## 3. Behavioral Differences

### 3.1 Popup Positioning

- **Python**: Uses grid-based overlap avoidance. Divides monitor into 50px squares, weights each by overlap with existing popups, then picks a random position within the chosen square. Also handles lowkey corner positioning.
- **TypeScript**: Uses `randomInt(0, max)` for both x and y. No overlap avoidance. No lowkey corner positioning.

### 3.2 Popup Sizing

- **Python**: `random.randint(30, 70)` percent of monitor (or 20-50% in lowkey mode), scaled to maintain aspect ratio.
- **TypeScript**: `randomInt(200, 400)` width × `randomInt(150, 300)` height, multiplied by `popupScale`. Fixed pixel range regardless of monitor size.

### 3.3 Audio Playback

- **Python**: Uses pyglet with streaming mode, fade in/out with configurable duration, automatic volume ramping.
- **TypeScript**: Uses HTML5 `<audio>` element. Volume set directly. No fade in/out implementation.

### 3.4 Video Playback

- **Python**: Uses mpv (with subprocess option), supports GLSL shaders for denial filters, supports animated GIF playback via mpv.
- **TypeScript**: Uses HTML5 `<video>` element. Denial filter applied via CSS. Animated GIFs shown as static images.

### 3.5 Denial Filters

- **Python**: PIL GaussianBlur (5/10/20px), resize-blur, or mpv GLSL shaders (gaussian blur, pixelize).
- **TypeScript**: CSS blur, saturate, brightness, hue-rotate filters with random parameters.

### 3.6 Spawn Tick Logic

- **Python**: Each type rolled independently via `RollTarget.chance()`. In single mode, one type chosen via `random.choices` weighted by chances.
- **TypeScript**: Single combined pool of images+videos, one random pick per tick. Audio, web, prompt, subliminal, and notification types not included in main spawn tick.

### 3.7 Corruption Mode

- **Python**: Full runtime with timed/popup/launch/script triggers, level progression, mood management, wallpaper/theme cycling, config overrides, and fade preview.
- **TypeScript**: UI controls only. `corruptionStore` has state but no timer/observer triggers or level progression logic.

### 3.8 Hibernate Mode

- **Python**: Full runtime with 6 activity types (Original/Spaced/Glitch/Ramp/Pump-Scare/Chaos), timer-based sleep/wake cycles, wallpaper reset, and tray skip button.
- **TypeScript**: UI controls and panel only. `hibernateStore` has state but no timer/scheduling logic.

---

## 4. Summary

### Config Parity: 100%
All 97 Python config options are present in the TS implementation. 5 TS-only options exist for features unique to the Electron version (popupScale, maxImages, mitosisChance, booruName, scheduleType).

### Feature Parity: ~70%
- **Fully ported**: Popup types (image/video/audio/subliminal/prompt), popup movement, hypno overlays, denial filters, captions, buttonless, multi-click, clickthrough, mitosis, panic, tray, Discord, notifications, wallpaper setting, web open, pack loading, config persistence, splash, scripting engine.
- **Partially ported**: Corruption mode (UI only, no runtime), hibernate mode (UI only, no runtime), panic lockout (config only), wallpaper rotation (config only), popup timeout (config only), single mode (config only), booru download (config only).
- **Not ported**: Media blacklist, popup overlap avoidance, lowkey corner positioning, corruption config overrides/danger checks/block list, hibernate wallpaper reset, pump-scare type, config validation, first-launch setup.
