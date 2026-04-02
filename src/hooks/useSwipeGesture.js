import { useEffect, useRef } from 'react'

/**
 * Detects horizontal swipe gestures on a container element.
 * Vertical swipes (scroll) are left untouched.
 */
export const useSwipeGesture = (containerRef, { onSwipeLeft, onSwipeRight, threshold = 45, velocityThreshold = 0.3 } = {}) => {
  const touch = useRef({ x: 0, y: 0, t: 0, tracking: false })

  useEffect(() => {
    const el = containerRef?.current
    if (!el) return

    const onStart = (e) => {
      const t = e.touches[0]
      touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), tracking: true }
    }

    const onMove = (e) => {
      if (!touch.current.tracking) return
      const dx = Math.abs(e.touches[0].clientX - touch.current.x)
      const dy = Math.abs(e.touches[0].clientY - touch.current.y)
      // If clearly scrolling vertically, stop tracking
      if (dy > dx * 1.5 && dy > 10) {
        touch.current.tracking = false
      }
    }

    const onEnd = (e) => {
      if (!touch.current.tracking) return
      touch.current.tracking = false

      const dx = e.changedTouches[0].clientX - touch.current.x
      const dy = e.changedTouches[0].clientY - touch.current.y
      const dt = Date.now() - touch.current.t
      const velocity = Math.abs(dx) / Math.max(dt, 1)

      if (
        Math.abs(dx) >= threshold &&
        Math.abs(dx) > Math.abs(dy) * 1.5 &&
        velocity >= velocityThreshold
      ) {
        if (dx < 0) onSwipeLeft?.()
        else onSwipeRight?.()
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove,  { passive: true })
    el.addEventListener('touchend',  onEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend',  onEnd)
    }
  }, [containerRef, onSwipeLeft, onSwipeRight, threshold, velocityThreshold])
}
