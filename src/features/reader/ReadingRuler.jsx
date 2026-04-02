import { useEffect, useState, useRef } from 'react'

export const ReadingRuler = ({ containerRef }) => {
  const [rulerY, setRulerY] = useState(200)
  const lineHeight = useRef(24)

  useEffect(() => {
    const handleMouseMove = (e) => {
      const container = containerRef?.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top + container.scrollTop
      const snappedY = Math.floor(y / lineHeight.current) * lineHeight.current
      setRulerY(snappedY)
    }

    const container = containerRef?.current
    if (!container) return
    container.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => container.removeEventListener('mousemove', handleMouseMove)
  }, [containerRef])

  return (
    <div
      className="reading-ruler pointer-events-none"
      style={{
        top: rulerY - lineHeight.current,
        position: 'absolute',
        left: 0,
        right: 0,
        height: lineHeight.current * 2,
        zIndex: 5,
      }}
    />
  )
}
