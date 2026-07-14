/**
 * Pack loader — scans pack directories and categorizes media files.
 *
 * This module runs in the Electron main process. It reads the filesystem
 * directly (no IPC needed since it's already on the main side).
 *
 * Media categorization rules:
 *   - IMAGE_EXTS: .png, .jpg, .jpeg, .gif, .bmp, .webp → images array
 *   - VIDEO_EXTS: .mp4, .webm, .mov → videos array
 *   - AUDIO_EXTS: .mp3, .wav, .ogg, .flac, .m4a, .aac → audio array
 *   - HYPN_EXTS: .gif ONLY → hypno array (also in images array)
 *
 * IMPORTANT: HYPN_EXTS was reduced from {mp4, webm, gif} to {gif} because
 * mp4/webm files should not be treated as hypno overlays — they are videos
 * with sound. Only gif files are silent looping animations suitable for
 * subliminal overlay on static images.
 *
 * FUTUREWORK: Add support for pack.json manifest files (index.json is already
 * supported but underutilized). Packs could declare their own media categories
 * and custom extensions.
 *
 * REMOVABLE: The `index.json` loading (loadIndex) is currently unused by the
 * spawn system — it's loaded but never referenced in the tick loop. Consider
 * removing if the index system is not needed.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import AdmZip from 'adm-zip'

/** Extensions recognized as static images (including gifs, which can also be hypno). */
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'])

/** Extensions recognized as video files (mp4/webm/mov only — ffmpeg-compatible). */
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov'])

/** Extensions recognized as audio files. */
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])

/** Extensions recognized as hypno overlays. ONLY gif — silent looping animation. */
const HYPN_EXTS = new Set(['.gif'])

function scanDirRecursive(dir: string): string[] {
  const results: string[] = []
  try {
    if (!fs.existsSync(dir)) return results
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...scanDirRecursive(fullPath))
      } else if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  } catch {
    // ignore permission errors and broken symlinks
  }
  return results
}

/**
 * Categorizes files into media buckets by extension.
 *
 * A single file can appear in multiple arrays (e.g., a .gif appears in both
 * `images` and `hypno`). This is intentional — the spawn tick uses `images`
 * for display and `hypno` for overlay selection independently.
 *
 * The `hypno` check is OUTSIDE the if/else chain so that gif files (which
 * match IMAGE_EXTS) are correctly added to both `images` and `hypno`.
 */
export function categorizeByExt(files: string[]): {
  images: string[]
  videos: string[]
  audio: string[]
  hypno: string[]
} {
  const images: string[] = []
  const videos: string[] = []
  const audio: string[] = []
  const hypno: string[] = []

  for (const f of files) {
    const ext = path.extname(f).toLowerCase()
    if (IMAGE_EXTS.has(ext)) {
      images.push(f)
    } else if (VIDEO_EXTS.has(ext)) {
      videos.push(f)
    } else if (AUDIO_EXTS.has(ext)) {
      audio.push(f)
    }
    // Hypno check is separate: gif files go to both images and hypno
    if (HYPN_EXTS.has(ext)) {
      hypno.push(f)
    }
  }

  return { images, videos, audio, hypno }
}

function readTextFile(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.split('\n').map(l => l.trim()).filter(Boolean)
  } catch {
    return []
  }
}

export interface PackInfo {
  name: string
  version: string
  author: string
  description: string
  icon?: string
}

export interface PackIndex {
  [key: string]: PackAsset[]
}

export interface PackAsset {
  path: string
  mood?: string
  type: 'image' | 'video' | 'audio' | 'hypno' | 'text'
}

export interface ScannedPack {
  info: PackInfo
  index: PackIndex
  media: {
    images: string[]
    videos: string[]
    audio: string[]
    hypno: string[]
  }
  texts: {
    captions: string[]
    denials: string[]
    prompts: string[]
    subliminals: string[]
    notifications: string[]
    web: string[]
  }
  script: string | null
  scriptVersion: 'v0' | 'v1' | null
}

/** Loads and categorizes all media/text/script files from a pack directory. */
export function loadPackFromDirectory(packPath: string): ScannedPack {
  const info: PackInfo = loadInfo(path.join(packPath, 'info.json'))
  const index: PackIndex = loadIndex(path.join(packPath, 'index.json'))

  const allFiles = scanDirRecursive(packPath)
  const media = categorizeByExt(allFiles)

  const texts = {
    captions: readTextFile(path.join(packPath, 'captions.txt')),
    denials: readTextFile(path.join(packPath, 'denials.txt')),
    prompts: readTextFile(path.join(packPath, 'prompts.txt')),
    subliminals: readTextFile(path.join(packPath, 'subliminals.txt')),
    notifications: readTextFile(path.join(packPath, 'notifications.txt')),
    web: readTextFile(path.join(packPath, 'web.txt')),
  }
  const script = readScript(path.join(packPath, 'script.lua'))
  const scriptVersion = detectScriptVersion(script)

  return { info, index, media, texts, script, scriptVersion }
}

/** Extracts a .zip pack to a temp directory and returns the extraction path. */
export function extractPackZip(zipPath: string): string {
  const zip = new AdmZip(zipPath)
  const extractDir = path.join(
    os.tmpdir(),
    'edgeware-pack-' + path.basename(zipPath, '.zip') + '-' + Date.now(),
  )
  zip.extractAllTo(extractDir, true)
  return extractDir
}

export function isZipFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.zip'
}

function loadInfo(filePath: string): PackInfo {
  try {
    if (!fs.existsSync(filePath)) {
      return { name: 'Unknown Pack', version: '0.0.0', author: 'Unknown', description: '' }
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return { name: 'Unknown Pack', version: '0.0.0', author: 'Unknown', description: '' }
  }
}

function loadIndex(filePath: string): PackIndex {
  try {
    if (!fs.existsSync(filePath)) return {}
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

function readScript(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function detectScriptVersion(script: string | null): 'v0' | 'v1' | null {
  if (!script) return null
  if (script.includes('require("edgeware_v1")')) return 'v1'
  if (script.includes('require("edgeware_v0")')) return 'v0'
  return null
}
