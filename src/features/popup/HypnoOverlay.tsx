import { useRef, useEffect } from 'react'

interface HypnoOverlayProps {
  src: string
  opacity: number
}

export function HypnoOverlay({ src, opacity }: HypnoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(src)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [src])

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={`file://${encodeURI(src)}`}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: opacity / 100,
          pointerEvents: 'none',
          zIndex: 1,
          objectFit: 'cover',
        }}
      />
    )
  }

  return (
    <img
      src={`file://${encodeURI(src)}`}
      alt="hypno"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: opacity / 100,
        pointerEvents: 'none',
        zIndex: 1,
        objectFit: 'cover',
      }}
    />
  )
}
