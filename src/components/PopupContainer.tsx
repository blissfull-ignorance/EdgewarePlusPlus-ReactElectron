import { usePopupStore } from '@/stores/popupStore'
import { useSubliminalStore } from '@/stores/subliminalStore'
import { AudioPopup } from '@/features/popup/AudioPopup'
import { SubliminalPopup } from '@/features/popup/SubliminalPopup'

export function PopupContainer() {
  const popups = usePopupStore((s) => s.popups)
  const removePopup = usePopupStore((s) => s.removePopup)
  const subliminals = useSubliminalStore((s) => s.subliminals)
  const removeSubliminal = useSubliminalStore((s) => s.removeSubliminal)
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
      {subliminals.map((sub) => (
        <SubliminalPopup
          key={sub.id}
          text={sub.text}
          x={sub.x}
          y={sub.y}
          opacity={sub.opacity}
          duration={sub.duration}
          onComplete={() => removeSubliminal(sub.id)}
        />
      ))}
    </>
  )
}
