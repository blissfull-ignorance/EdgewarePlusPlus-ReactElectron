import { useRef, useEffect } from 'react'

interface AudioPopupProps {
  src: string
  onClose?: () => void
}

export function AudioPopup({ src, onClose }: AudioPopupProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 1.0
      audioRef.current.play().catch(() => {})
    }
  }, [src])

  const handleEnded = () => {
    onClose?.()
  }

  return (
    <audio
      ref={audioRef}
      src={`file://${encodeURI(src)}`}
      autoPlay
      onEnded={handleEnded}
      style={{ display: 'none' }}
    />
  )
}
