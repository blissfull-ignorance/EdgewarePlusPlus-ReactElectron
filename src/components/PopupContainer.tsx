import { usePopupStore } from '@/stores/popupStore'
import { AudioPopup } from '@/features/popup/AudioPopup'

export function PopupContainer() {
  const popups = usePopupStore((s) => s.popups)
  const removePopup = usePopupStore((s) => s.removePopup)
  const audioPopups = popups.filter(p => p.type === 'audio')

  return (
    <>
      {audioPopups.map((popup) => (
        <AudioPopup
          key={popup.id}
          src={popup.mediaPath!}
          onClose={() => removePopup(popup.id)}
        />
      ))}
    </>
  )
}
