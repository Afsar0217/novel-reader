import { useRef, useEffect, useState, memo } from 'react'
import { motion } from 'framer-motion'
import { useReaderStore } from '../../store/readerStore'

export const MiniMap = memo(({ containerRef }) => {
  const { totalPages, currentPage, pdfDocument } = useReaderStore()
  const [viewportPos, setViewportPos] = useState({ top: 0, height: 20 })
  const minimapRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const container = containerRef?.current
    if (!container) return

    const update = () => {
      const scrollTop = container.scrollTop
      const totalHeight = container.scrollHeight
      const viewH = container.clientHeight
      const mapH = minimapRef.current?.clientHeight || 300

      const ratio = mapH / totalHeight
      const vpTop = scrollTop * ratio
      const vpH = Math.max(20, viewH * ratio)

      setViewportPos({ top: vpTop, height: vpH })
    }

    update()
    container.addEventListener('scroll', update, { passive: true })
    return () => container.removeEventListener('scroll', update)
  }, [containerRef])

  const handleMinimapClick = (e) => {
    const container = containerRef?.current
    const minimap = minimapRef.current
    if (!container || !minimap) return

    const rect = minimap.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const ratio = clickY / rect.height
    container.scrollTop = ratio * container.scrollHeight
  }

  if (!pdfDocument || !visible) return null

  const pageBlocks = Array.from({ length: totalPages }, (_, i) => ({
    index: i,
    isCurrent: i === currentPage,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="minimap-container cursor-pointer"
      ref={minimapRef}
      onClick={handleMinimapClick}
    >
      <div className="relative flex-1 flex flex-col gap-0.5 overflow-hidden">
        {pageBlocks.map(({ index, isCurrent }) => (
          <div
            key={index}
            className={`minimap-page ${isCurrent ? 'bg-accent/30' : ''}`}
            style={{ height: Math.max(2, 300 / totalPages) }}
          />
        ))}
        <div
          className="minimap-viewport"
          style={{ top: viewportPos.top, height: viewportPos.height }}
        />
      </div>
      <div className="text-center text-[9px] text-[var(--text-muted)] font-mono pb-0.5">
        {currentPage + 1}
      </div>
    </motion.div>
  )
})

MiniMap.displayName = 'MiniMap'
