import { useEffect, useState } from 'react'

interface SubliminalPopupProps {
  text: string
  x: number
  y: number
  opacity: number
  duration?: number
}

export function SubliminalPopup({
  text,
  x,
  y,
  opacity,
  duration = 500,
}: SubliminalPopupProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        opacity: opacity / 100,
        pointerEvents: 'none',
        zIndex: 5002,
        color: '#fff',
        fontSize: 24,
        fontWeight: 700,
        textShadow: '0 0 10px rgba(0,0,0,0.5)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.1s ease-out',
      }}
    >
      {text}
    </div>
  )
}
