import { useRef, useEffect } from 'react'
import { useConfigStore } from '@/stores/configStore'

export function audioToVolume(percent: number): number {
  return Math.max(0, Math.min(1, percent / 100))
}

export function fadeVolume(elapsed: number, target: number, duration: number): number {
  if (duration <= 0) return 0
  const t = Math.min(1, elapsed / duration)
  return t * target
}

export function canFadeIn(duration: number): boolean {
  return duration > 0
}

export function canFadeOut(duration: number): boolean {
  return duration > 0
}

interface AudioPopupProps {
  src: string
  onClose?: () => void
}

export function AudioPopup({ src, onClose }: AudioPopupProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fadeFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const cfg = useConfigStore.getState()
    const targetVolume = audioToVolume(cfg.audioVolume)
    const fadeInMs = cfg.fadeInDuration

    if (canFadeIn(fadeInMs)) {
      el.volume = 0
      const start = performance.now()
      const animate = () => {
        const elapsed = performance.now() - start
        el.volume = fadeVolume(elapsed, targetVolume, fadeInMs)
        if (elapsed < fadeInMs) {
          fadeFrameRef.current = requestAnimationFrame(animate)
        } else {
          el.volume = targetVolume
          fadeFrameRef.current = null
        }
      }
      fadeFrameRef.current = requestAnimationFrame(animate)
    } else {
      el.volume = targetVolume
    }

    el.play().catch(() => {})

    return () => {
      if (fadeFrameRef.current !== null) {
        cancelAnimationFrame(fadeFrameRef.current)
        fadeFrameRef.current = null
      }
      el.pause()
    }
  }, [src])

  const handleEnded = () => {
    const el = audioRef.current
    const cfg = useConfigStore.getState()
    const fadeOutMs = cfg.fadeOutDuration

    if (!el || !canFadeOut(fadeOutMs)) {
      onClose?.()
      return
    }

    const startVolume = el.volume
    const start = performance.now()
    const animate = () => {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / fadeOutMs)
      el.volume = startVolume * (1 - t)
      if (elapsed < fadeOutMs) {
        fadeFrameRef.current = requestAnimationFrame(animate)
      } else {
        el.volume = 0
        fadeFrameRef.current = null
        onClose?.()
      }
    }
    fadeFrameRef.current = requestAnimationFrame(animate)
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
