import { shell } from 'electron'

export async function openExternal(url: string): Promise<void> {
  await shell.openExternal(url)
}
