import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

export async function setWallpaper(path: string): Promise<void> {
  switch (process.platform) {
    case 'win32':
      await exec('rundll32.exe', [
        'user32.dll',
        'SystemParametersInfo',
        '20',
        '0',
        path,
        '3',
      ])
      break
    case 'darwin':
      await exec('osascript', [
        '-e',
        `tell app "Finder" to set desktop picture to POSIX file "${path}"`,
      ])
      break
    case 'linux':
      await exec('gsettings', [
        'set',
        'org.gnome.desktop.background',
        'picture-uri',
        `file://${path}`,
      ])
      break
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

export async function getWallpaper(): Promise<string> {
  switch (process.platform) {
    case 'win32':
      return ''
    case 'darwin': {
      const { stdout } = await exec('osascript', [
        '-e',
        'tell application "Finder" to get desktop picture',
      ])
      return stdout.trim()
    }
    case 'linux': {
      const { stdout: linuxOutput } = await exec('gsettings', [
        'get',
        'org.gnome.desktop.background',
        'picture-uri',
      ])
      return linuxOutput.trim().replace(/^'|'$/g, '')
    }
    default:
      return ''
  }
}
