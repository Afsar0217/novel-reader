import { useRef, useEffect, useState, memo } from 'react'
import { motion } from 'framer-motion'
import { usePDFPage, useIntersectionObserver } from '../../hooks/usePDFRenderer'
import { TextLayer } from './TextLayer'
import { Spinner } from '../../components/UI/Tooltip'

const PageCanvas = memo(({ pdfDoc, pageIndex, scale, highlights, bookId, onHighlight, isVisible, canInteract = true }) => {
  const { canvasRef, dimensions, textLayer, isRendered, error } = usePDFPage(
    pdfDoc, pageIndex, scale, isVisible
  )

  return (
    <div
      className="pdf-page-wrapper"
      style={{
        width: dimensions.width || 'auto',
        minHeight: dimensions.height || 800,
        background: 'var(--reading-bg)',
      }}
    >
      {!isRendered && !error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[var(--surface-1)]"
          style={{ minHeight: 800 }}
        >
          {isVisible && <Spinner size={28} />}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
          Failed to render page {pageIndex + 1}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="pdf-canvas-layer"
        style={{ display: isRendered ? 'block' : 'none' }}
      />

      {isRendered && textLayer && (
        <TextLayer
          textLayer={textLayer}
          pageIndex={pageIndex}
          highlights={highlights}
          bookId={bookId}
          onHighlight={onHighlight}
          canInteract={canInteract}
          dimensions={dimensions}
        />
      )}
    </div>
  )
})

PageCanvas.displayName = 'PageCanvas'

export const VirtualPage = ({ pdfDoc, pageIndex, scale, highlights, bookId, onHighlight, onVisible, estimatedHeight, canInteract = true }) => {
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef(null)

  const intersectionRef = useIntersectionObserver((entry) => {
    const visible = entry.isIntersecting
    setIsVisible(visible)
    if (visible) onVisible?.(pageIndex)
  }, { rootMargin: '400px 0px' })

  const combinedRef = (el) => {
    wrapperRef.current = el
    intersectionRef.current = el
  }

  return (
    <motion.div
      ref={combinedRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(pageIndex * 0.02, 0.15) }}
      className="relative"
      style={{ minHeight: estimatedHeight || 800, marginBottom: 16 }}
      id={`page-${pageIndex}`}
    >
      {isVisible ? (
        <PageCanvas
          pdfDoc={pdfDoc}
          pageIndex={pageIndex}
          scale={scale}
          highlights={highlights}
          bookId={bookId}
          onHighlight={onHighlight}
          isVisible={isVisible}
          canInteract={canInteract}
        />
      ) : (
        <div
          className="bg-[var(--surface-1)] rounded flex items-center justify-center"
          style={{ height: estimatedHeight || 800 }}
        >
          <span className="text-[var(--text-muted)] text-sm">Page {pageIndex + 1}</span>
        </div>
      )}

      <div className="absolute bottom-2 right-3 text-xs text-[var(--text-muted)] font-medium select-none pointer-events-none">
        {pageIndex + 1}
      </div>
    </motion.div>
  )
}
