import { useState, useCallback, useRef, useEffect } from 'react'
import { HypnoOverlay } from './HypnoOverlay'

interface VideoPopupProps {
  src: string
  x: number
  y: number
  width: number
  height: number
  opacity: number
  clickthrough: boolean
  clicksToClose: number
  popupClose: string
  buttonless: boolean
  denialFilter?: string
  hypnoMediaPath?: string
  hypnoOpacity?: number
  onClose?: () => void
}

export function VideoPopup({
  src,
  x,
  y,
  width,
  height,
  opacity,
  clickthrough,
  clicksToClose,
  popupClose,
  buttonless,
  denialFilter,
  hypnoMediaPath,
  hypnoOpacity,
  onClose,
}: VideoPopupProps) {
  const [remainingClicks, setRemainingClicks] = useState(clicksToClose)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 1.0
      videoRef.current.play().catch(() => {})
    }
  }, [src])

  const handleButtonClick = useCallback(() => {
    if (clickthrough || !onClose) return
    const next = remainingClicks - 1
    setRemainingClicks(next)
    if (next <= 0) {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
      onClose()
    }
  }, [clickthrough, remainingClicks, onClose])

  const handleBodyClick = useCallback(() => {
    if (clickthrough || !buttonless || !onClose) return
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    onClose()
  }, [clickthrough, buttonless, onClose])

  const showButton = !clickthrough && !buttonless
  const showCounterBadge = clickthrough ? false : buttonless && clicksToClose > 1

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width,
        height,
        opacity: opacity / 100,
        pointerEvents: clickthrough ? 'none' : 'auto',
        zIndex: 5001,
        cursor: clickthrough ? 'default' : buttonless ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
      onClick={handleBodyClick}
    >
      <video
        ref={videoRef}
        src={`file://${encodeURI(src)}`}
        autoPlay
        loop
        muted={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: denialFilter || 'none',
        }}
      />
      {hypnoMediaPath && hypnoOpacity !== undefined && (
        <HypnoOverlay src={hypnoMediaPath} opacity={hypnoOpacity} />
      )}
      {showButton && (
        <button
          onClick={handleButtonClick}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 5003,
            padding: '6px 14px',
            border: 'none',
            borderRadius: 4,
            background: 'rgba(20, 20, 35, 0.85)',
            color: 'rgba(255, 255, 255, 0.9)',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 13,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {clicksToClose > 1
            ? `${popupClose} (${clicksToClose - remainingClicks + 1}/${clicksToClose})`
            : popupClose}
        </button>
      )}
      {showCounterBadge && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {clicksToClose - remainingClicks + 1}/{clicksToClose}
        </div>
      )}
    </div>
  )
}
