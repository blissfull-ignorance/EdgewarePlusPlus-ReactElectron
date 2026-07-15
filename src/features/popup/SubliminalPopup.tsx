import { useEffect, useState } from 'react'

/**
 * SubliminalPopup — briefly flashes a text message on screen, then auto-dismisses.
 *
 * Ported from the Python Edgeware++ SubliminalPopup (Toplevel window):
 *   - Large text centered on screen (font size = min(screenW, screenH) / 10)
 *   - Word-wrapped at ~66% of screen width
 *   - Configurable opacity, auto-destroy after timeout
 *   - Always on top, clickthrough, no background
 *
 * The Python version picks a random monitor and centers on it. In Electron
 * (single-window renderer), we center on the current viewport instead.
 */
interface SubliminalPopupProps {
  text: string
  x: number
  y: number
  opacity: number
  duration?: number
  onComplete?: () => void
}

export function SubliminalPopup({
  text,
  x,
  y,
  opacity,
  duration = 500,
  onComplete,
}: SubliminalPopupProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onComplete])

  if (!visible) return null

  // Font and wrap sizing mirrors the Python original:
  //   font_size = min(monitor_width, monitor_height) // 10
  //   wraplength = monitor_width // 1.5
  // Use viewport dimensions (Electron window), not screen dimensions,
  // since position: fixed is relative to the viewport.
  const screenW = window.innerWidth || 1200
  const screenH = window.innerHeight || 800
  const fontSize = Math.round(Math.min(screenW, screenH) / 10)
  const wrapLength = Math.round(screenW / 1.5)

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        opacity: opacity / 100,
        pointerEvents: 'none',
        zIndex: 5002,
        color: '#fff',
        fontSize,
        fontWeight: 700,
        textShadow: '0 0 10px rgba(0,0,0,0.5)',
        userSelect: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxWidth: wrapLength,
        textAlign: 'center',
        transition: 'opacity 0.1s ease-out',
      }}
    >
      {text}
    </div>
  )
}
