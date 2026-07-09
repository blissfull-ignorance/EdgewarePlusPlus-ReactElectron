import { usePopupStore } from '@/stores/popupStore'
import { ImagePopup } from '@/features/popup/ImagePopup'
import { VideoPopup } from '@/features/popup/VideoPopup'
import { AudioPopup } from '@/features/popup/AudioPopup'
import { SubliminalPopup } from '@/features/popup/SubliminalPopup'

export function PopupContainer() {
  const popups = usePopupStore((s) => s.popups)
  const removePopup = usePopupStore((s) => s.removePopup)

  if (popups.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, pointerEvents: 'none' }}>
      {popups.map((popup) => {
        const handleClose = popup.clickthrough
          ? undefined
          : () => removePopup(popup.id)

        switch (popup.type) {
          case 'image':
            return (
              <ImagePopup
                key={popup.id}
                src={popup.mediaPath}
                x={popup.x}
                y={popup.y}
                width={popup.width}
                height={popup.height}
                opacity={popup.opacity}
                clickthrough={popup.clickthrough}
                clicksToClose={popup.clicksToClose}
                denialFilter={popup.denialFilter}
                hypnoMediaPath={popup.hypnoMediaPath}
                hypnoOpacity={popup.hypnoOpacity}
                onClose={handleClose}
              />
            )
          case 'video':
            return (
              <VideoPopup
                key={popup.id}
                src={popup.mediaPath}
                x={popup.x}
                y={popup.y}
                width={popup.width}
                height={popup.height}
                opacity={popup.opacity}
                clickthrough={popup.clickthrough}
                clicksToClose={popup.clicksToClose}
                denialFilter={popup.denialFilter}
                hypnoMediaPath={popup.hypnoMediaPath}
                hypnoOpacity={popup.hypnoOpacity}
                onClose={handleClose}
              />
            )
          case 'audio':
            return (
              <AudioPopup
                key={popup.id}
                src={popup.mediaPath}
                onClose={handleClose}
              />
            )
          case 'subliminal':
            return (
              <SubliminalPopup
                key={popup.id}
                text={popup.mediaPath}
                x={popup.x}
                y={popup.y}
                opacity={popup.opacity}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
