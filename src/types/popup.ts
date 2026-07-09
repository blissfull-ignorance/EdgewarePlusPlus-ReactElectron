export interface Popup {
  id: number
  type: 'image' | 'video' | 'audio' | 'prompt' | 'subliminal'
  mediaPath: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
  clickthrough: boolean
  clicksToClose: number
  denialFilter?: string
  hypnoMediaPath?: string
  hypnoOpacity?: number
  onClose?: () => void
}

export interface PopupState {
  popups: Popup[]
  popupCount: number
}
