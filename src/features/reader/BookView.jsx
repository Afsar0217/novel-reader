import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { usePDFPage } from '../../hooks/usePDFRenderer'
import { TextLayer } from './TextLayer'
import { Spinner } from '../../components/UI/Tooltip'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'

/* ── Single full-screen page ── */
const BookPage = memo(({ pdfDoc, pageIndex, scale, highlights, bookId, onHighlight }) => {
  const { canvasRef, dimensions, textLayer, isRendered, error } = usePDFPage(
    pdfDoc, pageIndex, scale, true
  )

  const w = dimensions.width  || Math.round(scale * 595)
  const h = dimensions.height || Math.round(scale * 842)

  return (
    <div
      className="relative bg-white overflow-hidden flex-shrink-0"
      style={{ width: w, height: h }}
    >
      {!isRendered && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Spinner size={24} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-center p-4">
          <p className="text-red-400 text-sm">Page {pageIndex + 1} couldn't render</p>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: isRendered ? 'block' : 'none' }} />
      {isRendered && textLayer && (
        <TextLayer
          textLayer={textLayer}
          pageIndex={pageIndex}
          highlights={highlights}
          bookId={bookId}
          onHighlight={onHighlight}
          dimensions={dimensions}
        />
      )}
    </div>
  )
})
BookPage.displayName = 'BookPage'

/* ════════════════════════════════════════════
   BOOK / SWIPE VIEW  — one page, fills screen
════════════════════════════════════════════ */
export const BookView = ({ onPageChange }) => {
  const { pdfDocument, currentPage, totalPages, setCurrentPage, currentBookId } = useReaderStore()
  const { addHighlight, getHighlightsForPage } = useAnnotationStore()

  const containerRef = useRef(null)
  const spreadRef    = useRef(null)

  const [containerSize, setContainerSize] = useState(null)   // null = not measured yet
  const [naturalSize,   setNaturalSize]   = useState(null)   // null = not fetched yet
  const [direction,     setDirection]     = useState(1)      // +1 forward / -1 backward

  /* ── Measure container ── */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (w, h) => { if (w > 0 && h > 0) setContainerSize({ width: w, height: h }) }
    // Wait one frame so layout is complete
    const raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      update(r.width, r.height)
    })
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      update(r.width, r.height)
    })
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  /* ── Get natural page dimensions ── */
  useEffect(() => {
    if (!pdfDocument) return
    let cancelled = false
    pdfDocument.getPage(1).then(page => {
      if (cancelled) return
      const vp = page.getViewport({ scale: 1 })
      setNaturalSize({ width: vp.width, height: vp.height })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pdfDocument])

  const ready = containerSize !== null && naturalSize !== null

  /* ── Compute scale so the page fills the container ── */
  const bookScale = useMemo(() => {
    if (!containerSize || !naturalSize) return null
    const BTN_W = 56   // space reserved for each nav button
    const PAD_V = 32   // vertical breathing room

    const availW = containerSize.width  - BTN_W * 2
    const availH = containerSize.height - PAD_V

    if (availW <= 0 || availH <= 0) return 0.5
    return Math.max(0.25, Math.min(availW / naturalSize.width, availH / naturalSize.height) * 0.99)
  }, [containerSize, naturalSize])

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    const next = Math.min(totalPages - 1, currentPage + 1)
    if (next === currentPage) return
    setDirection(1)
    setCurrentPage(next)
    onPageChange?.(next)
  }, [currentPage, totalPages, setCurrentPage, onPageChange])

  const goPrev = useCallback(() => {
    const prev = Math.max(0, currentPage - 1)
    if (prev === currentPage) return
    setDirection(-1)
    setCurrentPage(prev)
    onPageChange?.(prev)
  }, [currentPage, setCurrentPage, onPageChange])

  /* ── Swipe on the page ── */
  useSwipeGesture(spreadRef, { onSwipeLeft: goNext, onSwipeRight: goPrev })

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  const handleHighlight = useCallback((hl) => {
    if (currentBookId) addHighlight(currentBookId, hl)
  }, [currentBookId, addHighlight])

  /* ── Animation variants ── */
  const variants = {
    initial: (d) => ({ opacity: 0, x: d > 0 ?  40 : -40 }),
    animate: ()  => ({ opacity: 1, x: 0 }),
    exit:    (d) => ({ opacity: 0, x: d > 0 ? -40 :  40 }),
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center h-full w-full overflow-hidden"
      style={{ background: 'var(--surface-1)' }}
    >
      {/* Loading until measured */}
      {!ready && (
        <div className="flex flex-col items-center gap-3">
          <Spinner size={32} />
          <p className="text-xs text-[var(--text-muted)] animate-pulse">Loading page…</p>
        </div>
      )}

      {ready && bookScale && (
        <>
          {/* ── Prev button ── */}
          <button
            onClick={goPrev}
            disabled={currentPage === 0}
            aria-label="Previous page"
            className={`absolute left-1 sm:left-3 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center
              rounded-full bg-[var(--surface-0)]/80 backdrop-blur-sm border border-[var(--border)] shadow-md
              transition-all select-none
              ${currentPage === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-105 active:scale-95'}`}
          >
            <ChevronLeft size={20} className="text-[var(--text-primary)]" />
          </button>

          {/* ── Page ── */}
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              ref={spreadRef}
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{
                boxShadow: '0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.14)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <BookPage
                key={`${currentPage}-${bookScale}`}
                pdfDoc={pdfDocument}
                pageIndex={currentPage}
                scale={bookScale}
                highlights={getHighlightsForPage(currentBookId, currentPage)}
                bookId={currentBookId}
                onHighlight={handleHighlight}
              />
            </motion.div>
          </AnimatePresence>

          {/* ── Next button ── */}
          <button
            onClick={goNext}
            disabled={currentPage >= totalPages - 1}
            aria-label="Next page"
            className={`absolute right-1 sm:right-3 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center
              rounded-full bg-[var(--surface-0)]/80 backdrop-blur-sm border border-[var(--border)] shadow-md
              transition-all select-none
              ${currentPage >= totalPages - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100 hover:scale-105 active:scale-95'}`}
          >
            <ChevronRight size={20} className="text-[var(--text-primary)]" />
          </button>

          {/* ── Page indicator ── */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none
            bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
            {currentPage + 1} / {totalPages}
          </div>
        </>
      )}
    </div>
  )
}
