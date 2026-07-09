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
  denialFilter,
  hypnoMediaPath,
  hypnoOpacity,
  onClose,
}: VideoPopupProps) {
  const [clickCount, setClickCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 1.0
      videoRef.current.play().catch(() => {})
    }
  }, [src])

  const handleClick = useCallback(() => {
    if (clickthrough || !onClose) return
    const next = clickCount + 1
    setClickCount(next)
    if (next >= clicksToClose) {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
      }
      onClose()
    }
  }, [clickthrough, clickCount, clicksToClose, onClose])

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
        cursor: clickthrough ? 'default' : 'pointer',
        overflow: 'hidden',
      }}
      onClick={handleClick}
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
      {clicksToClose > 1 && !clickthrough && (
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
          {clickCount}/{clicksToClose}
        </div>
      )}
    </div>
  )
}
