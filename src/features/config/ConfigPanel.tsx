import { useCallback, useState } from 'react'
import {
  Tabs, Stack, Slider, NumberInput, Switch, TextInput, Select, Button,
  Group, Text, Paper, Title, Badge, Alert,
} from '@mantine/core'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import { useCorruptionStore } from '@/stores/corruptionStore'
import { usePackStore } from '@/stores/packStore'
import { useElectronAPI } from '@/hooks/useElectronAPI'
import type { Pack } from '@/types/pack'

const hibernateOptions = [
  { value: 'Original', label: 'Original' },
  { value: 'Spaced', label: 'Spaced' },
  { value: 'Glitch', label: 'Glitch' },
  { value: 'Ramp', label: 'Ramp' },
  { value: 'Pump-Scare', label: 'Pump-Scare' },
  { value: 'Chaos', label: 'Chaos' },
]

const themeOptions = [
  { value: 'Original', label: 'Original' },
  { value: 'Dark', label: 'Dark' },
  { value: 'The One', label: 'The One' },
  { value: 'Ransom', label: 'Ransom' },
  { value: 'Goth', label: 'Goth' },
  { value: 'Bimbo', label: 'Bimbo' },
]

const corruptionFadeOptions = [
  { value: 'Normal', label: 'Normal' },
  { value: 'Abrupt', label: 'Abrupt' },
  { value: 'Glitch', label: 'Glitch' },
  { value: 'Ramp', label: 'Ramp' },
]

const corruptionTriggerOptions = [
  { value: 'Timed', label: 'Timed' },
  { value: 'Popup', label: 'Popup' },
  { value: 'Launch', label: 'Launch' },
  { value: 'Script', label: 'Script' },
]

const scheduleTypeOptions = [
  { value: 'Relative', label: 'Relative' },
  { value: 'Absolute', label: 'Absolute' },
]

const timeUnitOptions = [
  { value: 'Minutes', label: 'Minutes' },
  { value: 'Hours', label: 'Hours' },
  { value: 'Days', label: 'Days' },
]

export function ConfigPanel() {
  const config = useConfigStore()
  const { inPanicMode, clearPanic, triggerPanic, running, setRunning } = useAppStore()
  const packStore = usePackStore()
  const corruptionOverrides = useCorruptionStore((s) => s.configOverrides)
  const corruptionLevel = useCorruptionStore((s) => s.level)
  const electronAPI = useElectronAPI()
  const [browsing, setBrowsing] = useState(false)

  const handleSave = useCallback(async () => {
    if (!electronAPI) return
    await electronAPI.saveConfig(config)
  }, [electronAPI, config])

  const handleBrowse = useCallback(async () => {
    if (!electronAPI) return
    setBrowsing(true)
    packStore.setError(null)
    try {
      const dir = await electronAPI.openDirectory()
      if (dir) {
        config.updateConfig({ packPath: dir })
      }
    } catch (e) {
      packStore.setError('Failed to open directory: ' + String(e))
    } finally {
      setBrowsing(false)
    }
  }, [electronAPI, config, packStore])

  const handleToggleRunning = useCallback(() => {
    if (running) {
      setRunning(false)
    } else if (packStore.pack) {
      setRunning(true)
    }
  }, [running, packStore.pack, setRunning])

  const handleLoadPack = useCallback(async () => {
    if (!electronAPI || !config.packPath) return
    packStore.setLoading(true)
    try {
      const raw = await electronAPI.loadPack(config.packPath)
      packStore.loadPack(raw as Pack)
    } catch (e) {
      packStore.setError(String(e))
    }
  }, [electronAPI, config.packPath, packStore])

  const noElectron = !electronAPI

  return (
    <Paper p="md" radius="md" style={{ maxWidth: 640, margin: '0 auto' }}>
      {noElectron && (
        <Alert color="yellow" mb="md" title="Browser Mode">
          Running outside Electron — pack loading and IPC features are unavailable.
          Use <code>npm run electron:dev</code> for full functionality.
        </Alert>
      )}

      <Group justify="space-between" mb="md">
        <Title order={3}>Edgeware++ Configuration</Title>
        <Group gap="xs">
          {running && <Badge color="grape" variant="filled">RUNNING</Badge>}
          {inPanicMode && (
            <Button color="red" size="xs" onClick={clearPanic}>Clear Panic</Button>
          )}
        </Group>
      </Group>

      <Tabs defaultValue="start">
        <Tabs.List mb="md">
          <Tabs.Tab value="start">Start</Tabs.Tab>
          <Tabs.Tab value="popupTypes">Popup Types</Tabs.Tab>
          <Tabs.Tab value="popupTweaks">Popup Tweaks</Tabs.Tab>
          <Tabs.Tab value="wallpaper">Wallpaper</Tabs.Tab>
          <Tabs.Tab value="booru">Booru</Tabs.Tab>
          <Tabs.Tab value="dangerous">Dangerous</Tabs.Tab>
          <Tabs.Tab value="modes">Modes</Tabs.Tab>
          <Tabs.Tab value="corruption">Corruption</Tabs.Tab>
          <Tabs.Tab value="troubleshooting">Troubleshooting</Tabs.Tab>
          <Tabs.Tab value="scheduler">Scheduler</Tabs.Tab>
          <Tabs.Tab value="pack">Pack</Tabs.Tab>
        </Tabs.List>

        {/* ── Start ── */}
        <Tabs.Panel value="start">
          <Stack gap="md">
            <div>
              <Text size="sm" mb="xs">Delay (ms) — {config.delay}ms</Text>
              <Slider value={config.delay} onChange={(v) => config.updateConfig({ delay: v })}
                min={100} max={30000} step={100}
                marks={[{ value: 100, label: '100ms' }, { value: 5000, label: '5s' }, { value: 30000, label: '30s' }]}
              />
            </div>
            <NumberInput label="Max Images" value={config.maxImages}
              onChange={(v) => config.updateConfig({ maxImages: Number(v) || 1 })}
              min={1} max={500}
            />
            <NumberInput label="Max Videos" value={config.maxVideos}
              onChange={(v) => config.updateConfig({ maxVideos: Number(v) || 1 })}
              min={1} max={500}
            />
            <NumberInput label="Max Audio" value={config.maxAudio}
              onChange={(v) => config.updateConfig({ maxAudio: Number(v) || 1 })}
              min={1} max={50}
            />
            <Switch label="Show Loading Flair" description="Startup splash animation"
              checked={config.showLoadingFlair}
              onChange={(e) => config.updateConfig({ showLoadingFlair: e.currentTarget.checked })}
            />
            <Switch label="Show Discord Presence"
              checked={config.showDiscord}
              onChange={(e) => config.updateConfig({ showDiscord: e.currentTarget.checked })}
            />
            <Switch label="Run on PC Startup"
              checked={config.start_on_logon}
              onChange={(e) => config.updateConfig({ start_on_logon: e.currentTarget.checked })}
            />
            <Select label="UI Theme" data={themeOptions} value={config.themeType}
              onChange={(v) => config.updateConfig({ themeType: v || 'Original' })}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Popup Types ── */}
        <Tabs.Panel value="popupTypes">
          <Stack gap="md">
            <Text size="sm" c="dimmed">Each type has an independent chance (0-100%) of spawning per tick.</Text>
            <SliderLabel label="Image Chance" value={config.popupMod} onChange={(v) => config.updateConfig({ popupMod: v })} />
            <SliderLabel label="Video Chance" value={config.vidMod} onChange={(v) => config.updateConfig({ vidMod: v })} />
            <SliderLabel label="Video Volume (%)" value={config.videoVolume} onChange={(v) => config.updateConfig({ videoVolume: v })} />
            <SliderLabel label="Audio Volume (%)" value={config.audioVolume} onChange={(v) => config.updateConfig({ audioVolume: v })} />
            <SliderLabel label="Audio Chance" value={config.audioMod} onChange={(v) => config.updateConfig({ audioMod: v })} />
            <NumberInput label="Fade In Duration (ms)" value={config.fadeInDuration}
              onChange={(v) => config.updateConfig({ fadeInDuration: Math.max(0, Number(v) || 0) })}
              min={0} max={30000} step={100}
            />
            <NumberInput label="Fade Out Duration (ms)" value={config.fadeOutDuration}
              onChange={(v) => config.updateConfig({ fadeOutDuration: Math.max(0, Number(v) || 0) })}
              min={0} max={30000} step={100}
            />
            <SliderLabel label="Web Popup Chance" value={config.webMod} onChange={(v) => config.updateConfig({ webMod: v })} />
            <SliderLabel label="Prompt Chance" value={config.promptMod} onChange={(v) => config.updateConfig({ promptMod: v })} />
            <NumberInput label="Max Prompt Mistakes" value={config.promptMistakes}
              onChange={(v) => config.updateConfig({ promptMistakes: Math.max(0, Number(v) || 0) })}
              min={0} max={99}
            />
            <SliderLabel label="Notification Chance" value={config.notificationChance} onChange={(v) => config.updateConfig({ notificationChance: v })} />
            <SliderLabel label="Notification Image Chance (%)" value={config.notificationImageChance} onChange={(v) => config.updateConfig({ notificationImageChance: v })} />
            <SliderLabel label="Subliminal Popup Chance" value={config.capPopChance} onChange={(v) => config.updateConfig({ capPopChance: v })} />
            <SliderLabel label="Hypno Overlay Chance" value={config.subliminalsChance} onChange={(v) => config.updateConfig({ subliminalsChance: v })} />
            <SliderLabel label="Denial Filter Chance" value={config.denialChance} onChange={(v) => config.updateConfig({ denialChance: v })} />
            <Switch label="Open Web on Popup Close"
              checked={config.webPopup}
              onChange={(e) => config.updateConfig({ webPopup: e.currentTarget.checked })}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Popup Tweaks ── */}
        <Tabs.Panel value="popupTweaks">
          <Stack gap="md">
            <div>
              <Text size="sm" mb="xs">Popup Size Scale — {config.popupScale.toFixed(1)}x</Text>
              <Slider value={config.popupScale} onChange={(v) => config.updateConfig({ popupScale: v })}
                min={0.5} max={3} step={0.1}
                marks={[{ value: 0.5, label: '0.5x' }, { value: 1, label: '1x' }, { value: 1.5, label: '1.5x' }, { value: 2, label: '2x' }, { value: 3, label: '3x' }]}
              />
            </div>
            <Switch label="Show Captions in Popups"
              checked={config.showCaptions}
              onChange={(e) => config.updateConfig({ showCaptions: e.currentTarget.checked })}
            />
            <Switch label="Buttonless Popups" description="Hide close buttons"
              checked={config.buttonless}
              onChange={(e) => config.updateConfig({ buttonless: e.currentTarget.checked })}
            />
            <Switch label="Clickthrough Popups" description="Popups won't intercept clicks"
              checked={config.clickthroughPopups}
              onChange={(e) => config.updateConfig({ clickthroughPopups: e.currentTarget.checked })}
            />
            <Switch label="Multi-Click Popups" description="Multiple clicks required to close"
              checked={config.multiClick}
              onChange={(e) => config.updateConfig({ multiClick: e.currentTarget.checked })}
            />
            <Switch label="Timeout Popups" description="Auto-close after a duration"
              checked={config.timeoutPopups}
              onChange={(e) => config.updateConfig({ timeoutPopups: e.currentTarget.checked })}
            />
            {config.timeoutPopups && (
              <NumberInput label="Popup Timeout (seconds)" value={config.popupTimeout}
                onChange={(v) => config.updateConfig({ popupTimeout: Number(v) || 1 })}
                min={1} max={300}
              />
            )}
            <SliderLabel label="Hypno Overlay Opacity (%)" value={config.subliminalsAlpha} onChange={(v) => config.updateConfig({ subliminalsAlpha: v })} />
            <SliderLabel label="Subliminal Popup Opacity (%)" value={config.capPopOpacity} onChange={(v) => config.updateConfig({ capPopOpacity: v })} />
            <NumberInput label="Subliminal Popup Timeout (ms)" value={config.capPopTimer}
              onChange={(v) => config.updateConfig({ capPopTimer: Number(v) || 1 })}
              min={1} max={3600}
            />
            <Group>
              <TextInput label="Subliminal Text Color" description="CSS color (hex, name, rgb)"
                value={config.capPopTextColor}
                onChange={(e) => config.updateConfig({ capPopTextColor: e.currentTarget.value || '#ffffff' })}
                style={{ flex: 1 }}
              />
              <div style={{
                width: 32, height: 32, borderRadius: 4, border: '1px solid #555',
                backgroundColor: config.capPopTextColor, alignSelf: 'flex-end', marginBottom: 2,
              }} />
            </Group>
            <NumberInput label="Subliminal Text Size (px)" value={config.capPopTextSize}
              onChange={(v) => config.updateConfig({ capPopTextSize: Number(v) || 80 })}
              min={12} max={500}
            />
            <SliderLabel label="Moving Popup Chance (%)" value={config.movingChance} onChange={(v) => config.updateConfig({ movingChance: v })} />
            <NumberInput label="Moving Popup Speed" value={config.movingSpeed}
              onChange={(v) => config.updateConfig({ movingSpeed: Number(v) || 1 })}
              min={1} max={50}
            />
            <TextInput label="Avoid List" description="Protected directories (separated by >)"
              value={config.avoidList}
              onChange={(e) => config.updateConfig({ avoidList: e.currentTarget.value })}
            />
            <TextInput label="Disabled Monitors" description="Monitor indices to exclude (comma-separated)"
              value={config.disabledMonitors.join(',')}
              onChange={(e) => config.updateConfig({
                disabledMonitors: e.currentTarget.value
                  .split(',')
                  .map(s => s.trim())
                  .filter(s => s.length > 0)
              })}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Wallpaper ── */}
        <Tabs.Panel value="wallpaper">
          <Stack gap="md">
            <Switch label="Rotate Wallpaper"
              checked={config.rotateWallpaper}
              onChange={(e) => config.updateConfig({ rotateWallpaper: e.currentTarget.checked })}
            />
            {config.rotateWallpaper && (
              <>
                <NumberInput label="Wallpaper Timer (seconds)" value={config.wallpaperTimer}
                  onChange={(v) => config.updateConfig({ wallpaperTimer: Number(v) || 1 })}
                  min={1} max={3600}
                />
                <NumberInput label="Wallpaper Variance (seconds)" value={config.wallpaperVariance}
                  onChange={(v) => config.updateConfig({ wallpaperVariance: Number(v) || 0 })}
                  min={0} max={3600}
                />
              </>
            )}
            <TextInput label="Wallpaper Data" description="Internal JSON field for wallpaper paths"
              value={config.wallpaperDat}
              onChange={(e) => config.updateConfig({ wallpaperDat: e.currentTarget.value })}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Booru ── */}
        <Tabs.Panel value="booru">
          <Stack gap="md">
            <Switch label="Enable Booru Download"
              checked={config.downloadEnabled}
              onChange={(e) => config.updateConfig({ downloadEnabled: e.currentTarget.checked })}
            />
            {config.downloadEnabled && (
              <>
                <TextInput label="Booru Username" value={config.booruName}
                  onChange={(e) => config.updateConfig({ booruName: e.currentTarget.value })}
                />
                <TextInput label="Tags" value={config.tagList}
                  onChange={(e) => config.updateConfig({ tagList: e.currentTarget.value })}
                />
                <NumberInput label="Minimum Score" value={config.booruMinScore}
                  onChange={(v) => config.updateConfig({ booruMinScore: Number(v) || -5 })}
                  min={-99} max={99}
                />
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Dangerous ── */}
        <Tabs.Panel value="dangerous">
          <Stack gap="md">
            <Switch label="Fill Drive Mode" description="Fills drive with junk data"
              checked={config.fill}
              onChange={(e) => config.updateConfig({ fill: e.currentTarget.checked })}
            />
            <Switch label="Replace Images Mode" description="Replaces images on drive"
              checked={config.replace}
              onChange={(e) => config.updateConfig({ replace: e.currentTarget.checked })}
            />
            {config.fill && (
              <NumberInput label="Fill Delay" value={config.fill_delay}
                onChange={(v) => config.updateConfig({ fill_delay: Number(v) || 0 })}
                min={0} max={10000}
              />
            )}
            {config.replace && (
              <NumberInput label="Replace Threshold" value={config.replaceThresh}
                onChange={(v) => config.updateConfig({ replaceThresh: Number(v) || 0 })}
                min={0} max={9999}
              />
            )}
            <TextInput label="Drive Path" description="Target drive for fill/replace"
              value={config.drivePath}
              onChange={(e) => config.updateConfig({ drivePath: e.currentTarget.value })}
            />
            <Switch label="Timer Mode (Panic Lockout)" description="Requires safeword to exit"
              checked={config.timerMode}
              onChange={(e) => config.updateConfig({ timerMode: e.currentTarget.checked })}
            />
            {config.timerMode && (
              <>
                <NumberInput label="Lockout Duration (minutes)" value={config.timerSetupTime}
                  onChange={(v) => config.updateConfig({ timerSetupTime: Number(v) || 1 })}
                  min={1} max={1440}
                />
                <TextInput label="Safeword" value={config.safeword}
                  onChange={(e) => config.updateConfig({ safeword: e.currentTarget.value })}
                />
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Modes ── */}
        <Tabs.Panel value="modes">
          <Stack gap="md">
            <Switch label="Hibernate Mode"
              checked={config.hibernateMode}
              onChange={(e) => config.updateConfig({ hibernateMode: e.currentTarget.checked })}
            />
            {config.hibernateMode && (
              <>
                <Select label="Hibernate Type" data={hibernateOptions} value={config.hibernateType}
                  onChange={(v) => config.updateConfig({ hibernateType: v || 'Original' })}
                />
                <NumberInput label="Hibernate Length (seconds)" value={config.hibernateLength}
                  onChange={(v) => config.updateConfig({ hibernateLength: Number(v) || 1 })}
                  min={1} max={3600}
                />
                <NumberInput label="Min Sleep (seconds)" value={config.hibernateMin}
                  onChange={(v) => config.updateConfig({ hibernateMin: Number(v) || 1 })}
                  min={1} max={86400}
                />
                <NumberInput label="Max Sleep (seconds)" value={config.hibernateMax}
                  onChange={(v) => config.updateConfig({ hibernateMax: Number(v) || 1 })}
                  min={1} max={86400}
                />
                <NumberInput label="Awaken Activity Level" value={config.wakeupActivity}
                  onChange={(v) => config.updateConfig({ wakeupActivity: Number(v) || 1 })}
                  min={1} max={100}
                />
                <Switch label="Fix Wallpaper on Hibernate End"
                  checked={config.fixWallpaper}
                  onChange={(e) => config.updateConfig({ fixWallpaper: e.currentTarget.checked })}
                />
              </>
            )}
            <Switch label="Lowkey Mode"
              checked={config.lkToggle}
              onChange={(e) => config.updateConfig({ lkToggle: e.currentTarget.checked })}
            />
            {config.lkToggle && (
              <>
                  <NumberInput label="Lowkey Corner (0-4)" value={config.lkCorner}
                    onChange={(v) => config.updateConfig({ lkCorner: Number(v) || 0 })}
                    min={0} max={4}
                  />
                <SliderLabel label="Lowkey Opacity (%)" value={config.lkScaling}
                  onChange={(v) => config.updateConfig({ lkScaling: v })} />
              </>
            )}
            <Switch label="Mitosis Mode" description="Popups spawn more popups"
              checked={config.mitosisMode}
              onChange={(e) => config.updateConfig({ mitosisMode: e.currentTarget.checked })}
            />
            {config.mitosisMode && (
              <>
                <SliderLabel label="Mitosis Chance (%)" value={config.mitosisChance}
                  onChange={(v) => config.updateConfig({ mitosisChance: v })} />
                <NumberInput label="Mitosis Strength" value={config.mitosisStrength}
                  onChange={(v) => config.updateConfig({ mitosisStrength: Number(v) || 1 })}
                  min={1} max={50}
                />
              </>
            )}
            <Switch label="Single Mode" description="Only one popup type per cycle"
              checked={config.singleMode}
              onChange={(e) => config.updateConfig({ singleMode: e.currentTarget.checked })}
            />
          </Stack>
        </Tabs.Panel>

        {/* ── Corruption ── */}
        <Tabs.Panel value="corruption">
          <Stack gap="md">
            <Switch label="Corruption Mode"
              checked={config.corruptionMode}
              onChange={(e) => config.updateConfig({ corruptionMode: e.currentTarget.checked })}
            />
            {config.corruptionMode && (
              <>
                {corruptionLevel > 0 && (
                  <Alert color="grape" title={`Corruption Level ${corruptionLevel}`} variant="light">
                    <Text size="sm">
                      {Object.keys(corruptionOverrides).length > 0
                        ? `Overriding ${Object.keys(corruptionOverrides).length} config value(s)`
                        : 'No config overrides active'}
                    </Text>
                  </Alert>
                )}
                <Select label="Trigger Type" data={corruptionTriggerOptions} value={config.corruptionTrigger}
                  onChange={(v) => config.updateConfig({ corruptionTrigger: v || 'Timed' })}
                />
                {config.corruptionTrigger === 'Timed' && (
                  <NumberInput label="Trigger Time (minutes)" value={config.corruptionTime}
                    onChange={(v) => config.updateConfig({ corruptionTime: Number(v) || 1 })}
                    min={1} max={1440}
                  />
                )}
                {config.corruptionTrigger === 'Popup' && (
                  <NumberInput label="Popup Count Trigger" value={config.corruptionPopups}
                    onChange={(v) => config.updateConfig({ corruptionPopups: Number(v) || 1 })}
                    min={1} max={999}
                  />
                )}
                {config.corruptionTrigger === 'Launch' && (
                  <NumberInput label="Launch Count Trigger" value={config.corruptionLaunches}
                    onChange={(v) => config.updateConfig({ corruptionLaunches: Number(v) || 1 })}
                    min={1} max={999}
                  />
                )}
                <Select label="Fade Type" data={corruptionFadeOptions} value={config.corruptionFadeType}
                  onChange={(v) => config.updateConfig({ corruptionFadeType: v || 'Normal' })}
                />
                <Switch label="Full Permissions"
                  checked={config.corruptionFullPerm}
                  onChange={(e) => config.updateConfig({ corruptionFullPerm: e.currentTarget.checked })}
                />
                <Switch label="Wallpaper Cycle"
                  checked={config.corruptionWallpaperCycle}
                  onChange={(e) => config.updateConfig({ corruptionWallpaperCycle: e.currentTarget.checked })}
                />
                <Switch label="Theme Cycle"
                  checked={config.corruptionThemeCycle}
                  onChange={(e) => config.updateConfig({ corruptionThemeCycle: e.currentTarget.checked })}
                />
                <Switch label="Purity Mode"
                  checked={config.corruptionPurityMode}
                  onChange={(e) => config.updateConfig({ corruptionPurityMode: e.currentTarget.checked })}
                />
                <Switch label="Dev Mode"
                  checked={config.corruptionDevMode}
                  onChange={(e) => config.updateConfig({ corruptionDevMode: e.currentTarget.checked })}
                />
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Troubleshooting ── */}
        <Tabs.Panel value="troubleshooting">
          <Stack gap="md">
            <Switch label="Safe Mode"
              checked={config.safeMode}
              onChange={(e) => config.updateConfig({ safeMode: e.currentTarget.checked })}
            />
            <Switch label="Disable Internet Checks"
              checked={config.toggleInternet}
              onChange={(e) => config.updateConfig({ toggleInternet: e.currentTarget.checked })}
            />
            <Switch label="Disable Help Messages"
              checked={config.messageOff}
              onChange={(e) => config.updateConfig({ messageOff: e.currentTarget.checked })}
            />
            <Switch label="Toggle Hibernate Skip"
              checked={config.toggleHibSkip}
              onChange={(e) => config.updateConfig({ toggleHibSkip: e.currentTarget.checked })}
            />
            <Switch label="Toggle Mood Set"
              checked={config.toggleMoodSet}
              onChange={(e) => config.updateConfig({ toggleMoodSet: e.currentTarget.checked })}
            />
            <Switch label="Create Desktop Icons"
              checked={config.desktopIcons}
              onChange={(e) => config.updateConfig({ desktopIcons: e.currentTarget.checked })}
            />
            <Switch label="Run on Save & Quit"
              checked={config.runOnSaveQuit}
              onChange={(e) => config.updateConfig({ runOnSaveQuit: e.currentTarget.checked })}
            />
            <Switch label="Dangerous Preset Warnings"
              checked={config.presetsDanger}
              onChange={(e) => config.updateConfig({ presetsDanger: e.currentTarget.checked })}
            />
            <Switch label="Video Hardware Acceleration"
              checked={config.videoHardwareAcceleration}
              onChange={(e) => config.updateConfig({ videoHardwareAcceleration: e.currentTarget.checked })}
            />
            <Switch label="mpv Subprocess Mode"
              checked={config.mpvSubprocess}
              onChange={(e) => config.updateConfig({ mpvSubprocess: e.currentTarget.checked })}
            />
            <Switch label="Theme Ignores Corruption Changes"
              checked={config.themeNoConfig}
              onChange={(e) => config.updateConfig({ themeNoConfig: e.currentTarget.checked })}
            />
            <Switch label="Disable Panic Hotkey"
              checked={config.panicDisabled}
              onChange={(e) => config.updateConfig({ panicDisabled: e.currentTarget.checked })}
            />
            <TextInput label="Global Panic Key" description="Universal panic hotkey"
              value={config.globalPanicButton}
              onChange={(e) => config.updateConfig({ globalPanicButton: e.currentTarget.value })}
            />
            <TextInput label="Per-Popup Panic Button" description="Per-popup panic key override"
              value={config.panicButton}
              onChange={(e) => config.updateConfig({ panicButton: e.currentTarget.value })}
            />
            <Button color="red" variant="outline" onClick={triggerPanic}>
              Trigger Panic (Test)
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* ── Scheduler ── */}
        <Tabs.Panel value="scheduler">
          <Stack gap="md">
            <Switch label="Enable Schedule"
              checked={config.schedule}
              onChange={(e) => config.updateConfig({ schedule: e.currentTarget.checked })}
            />
            {config.schedule && (
              <>
                <Select label="Schedule Type" data={scheduleTypeOptions} value={config.scheduleType}
                  onChange={(v) => config.updateConfig({ scheduleType: v || 'Relative' })}
                />
                <NumberInput label="Schedule Time" value={config.scheduleTime}
                  onChange={(v) => config.updateConfig({ scheduleTime: Number(v) || 0 })}
                  min={0} max={999}
                />
                <Select label="Time Unit" data={timeUnitOptions} value={config.timeType}
                  onChange={(v) => config.updateConfig({ timeType: v || 'Hours' })}
                />
                <NumberInput label="Variance Time" value={config.varianceTime}
                  onChange={(v) => config.updateConfig({ varianceTime: Number(v) || 0 })}
                  min={0} max={999}
                />
                <Select label="Variance Unit" data={timeUnitOptions} value={config.varianceType}
                  onChange={(v) => config.updateConfig({ varianceType: v || 'Hours' })}
                />
                <Switch label="Repeat Schedule"
                  checked={config.repeatSchedule}
                  onChange={(e) => config.updateConfig({ repeatSchedule: e.currentTarget.checked })}
                />
                {config.repeatSchedule && (
                  <>
                    <Select label="Repeat Unit" data={timeUnitOptions} value={config.repeatType}
                      onChange={(v) => config.updateConfig({ repeatType: v || 'Hours' })}
                    />
                    <NumberInput label="Repeat Time" value={config.repeatTime}
                      onChange={(v) => config.updateConfig({ repeatTime: Number(v) || 0 })}
                      min={0} max={999}
                    />
                  </>
                )}
              </>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Pack ── */}
        <Tabs.Panel value="pack">
          <Stack gap="md">
            <TextInput
              label="Pack Path" description="Path to the pack directory or .zip"
              value={config.packPath}
              onChange={(e) => config.updateConfig({ packPath: e.currentTarget.value })}
              placeholder="/path/to/pack"
              rightSection={
                <Button size="compact-xs" variant="subtle" onClick={handleBrowse} loading={browsing}>
                  Browse
                </Button>
              }
            />
            <Group gap="xs">
              <Button onClick={handleLoadPack}
                disabled={!config.packPath || noElectron}
                loading={packStore.loading}
                color="grape" variant="light"
              >
                Load Pack
              </Button>
            </Group>
            {packStore.error && <Text size="xs" c="red">{packStore.error}</Text>}
            {packStore.pack && (
              <Paper p="sm" withBorder>
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>{packStore.pack.info.name}</Text>
                  <Badge size="xs" variant="light">{packStore.pack.info.version}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">by {packStore.pack.info.author}</Text>
                <Text size="xs" c="dimmed" mb="xs">{packStore.pack.info.description}</Text>
                <Group gap="xs">
                  <Badge size="xs" color="blue">{packStore.pack.media.images.length} images</Badge>
                  <Badge size="xs" color="orange">{packStore.pack.media.videos.length} videos</Badge>
                  <Badge size="xs" color="green">{packStore.pack.media.audio.length} audio</Badge>
                  <Badge size="xs" color="grape">{packStore.getTexts('subliminal').length} subliminals</Badge>
                </Group>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="lg">
        <Button onClick={handleToggleRunning}
          color={running ? 'red' : 'grape'}
          disabled={!packStore.pack}
        >
          {running ? 'Stop' : 'Start'}
        </Button>
        <Button onClick={handleSave} color="grape" variant="light">Save Configuration</Button>
      </Group>
    </Paper>
  )
}

function SliderLabel({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Text size="sm" mb="xs">{label} — {value}%</Text>
      <Slider value={value} onChange={onChange} min={0} max={100} step={1} />
    </div>
  )
}
