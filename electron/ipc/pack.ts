import fs from 'fs'
import path from 'path'
import os from 'os'
import AdmZip from 'adm-zip'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov'])
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'])
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
    // ignore
  }
  return results
}

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
