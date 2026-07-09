export interface EdgewareCallbacks {
  openImage: (filename?: string) => number
  openVideo: (filename?: string) => number
  playAudio: (filename?: string) => number
  openPrompt: (text?: string) => number
  after: (ms: number, callbackId: string) => void
  roll: (chance: number) => boolean
  progressCorruption: () => void
  setWallpaper: (filename: string) => void
  panic: () => void
  closePopups: () => void
  setActiveMoods: (moods: string[]) => void
  enableMood: (mood: string) => void
  disableMood: (mood: string) => void
  setPopupCloseText: (text: string) => void
  setPromptCommandText: (text: string) => void
  setPromptSubmitText: (text: string) => void
  setPromptMinLength: (length: number) => void
  setPromptMaxLength: (length: number) => void
  openWeb: (url?: string) => void
  openSubliminal: (text?: string) => void
  sendNotification: (text?: string) => void
  connectOnPopupOpen: (callbackId: string) => void
  connectOnPopupClose: (callbackId: string) => void
}

export class CallbackStore {
  private callbacks = new Map<number, () => void>()
  private popupCallbacks = new Map<number, number>()
  private nextId = 1

  store(fn: () => void): number {
    const id = this.nextId++
    this.callbacks.set(id, fn)
    return id
  }

  mapPopupToCallback(popupId: number, fn: () => void): number {
    const cbId = this.store(fn)
    this.popupCallbacks.set(popupId, cbId)
    return cbId
  }

  invoke(id: number, ..._args: unknown[]): void {
    const fn = this.callbacks.get(id)
    if (!fn) return
    fn()
  }

  invokeForPopup(popupId: number): void {
    const cbId = this.popupCallbacks.get(popupId)
    if (!cbId) return
    this.invoke(cbId)
    this.popupCallbacks.delete(popupId)
    this.callbacks.delete(cbId)
  }

  release(id: number): void {
    this.callbacks.delete(id)
  }

  clear(): void {
    this.callbacks.clear()
    this.popupCallbacks.clear()
  }
}
