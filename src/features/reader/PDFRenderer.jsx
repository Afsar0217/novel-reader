import { useRef, useEffect, useState, useCallback } from 'react'
import { useReaderStore } from '../../store/readerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useUserStore } from '../../store/userStore'
import { VirtualPage } from './PageCanvas'
import { AnnotationToolbar } from './TextLayer'
import { ReadingRuler } from './ReadingRuler'

const PAGE_GAP = 24
// Natural PDF page width in points (A4 / US Letter portrait)
const NATURAL_PDF_WIDTH = 595

/**
 * PDFRenderer — continuous scroll view.
 *
 * Props:
 *  canInteract    — true for Owner/Reader, false for Viewer.
 *                   Viewers cannot manually scroll or create highlights.
 *  onSyncHighlight(bookId, highlight) — called when a highlight is created,
 *                   so it can be broadcast to other room members.
 */
export const PDFRenderer = ({ onScroll, readingContainerRef, canInteract = true, onSyncHighlight }) => {
  const { pdfDocument, currentPage, scrollPosition, setCurrentPage, setScrollPosition, currentBookId } = useReaderStore()
  const { addHighlight, getHighlightsForPage, toolbarPosition, selectedText, clearSelection } = useAnnotationStore()
  const { preferences } = useUserStore()
  const { rulerEnabled, focusBlur } = preferences

  const internalRef = useRef(null)
  const containerRef = readingContainerRef || internalRef
  const [pageHeights, setPageHeights] = useState({})
  const [visiblePage, setVisiblePage] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const scrollRestored = useRef(false)
  const totalPages = pdfDocument?.numPages || 0

  /* ── Measure container width for responsive PDF scaling ─────── */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [pdfDocument])

  // Restore saved scroll position on load
  useEffect(() => {
    if (!containerRef.current || scrollRestored.current || !pdfDocument) return
    const restore = () => {
      if (containerRef.current && scrollPosition > 0) {
        containerRef.current.scrollTop = scrollPosition
        scrollRestored.current = true
      }
    }
    const timer = setTimeout(restore, 200)
    return () => clearTimeout(timer)
  }, [pdfDocument])

  // ── Block manual scroll for viewers ──────────────────────────────────────
  // We attach non-passive wheel + touchmove listeners directly so we can call
  // preventDefault(). React's synthetic events are passive by default and
  // cannot prevent scroll.  Programmatic scrollTo() (from sync events) still
  // works because it bypasses these listeners entirely.
  useEffect(() => {
    if (canInteract || !containerRef.current) return
    const el = containerRef.current

    const prevent = (e) => e.preventDefault()
    el.addEventListener('wheel',     prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })

    return () => {
      el.removeEventListener('wheel',     prevent)
      el.removeEventListener('touchmove', prevent)
    }
  }, [canInteract, containerRef])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const st = containerRef.current.scrollTop
    setScrollPosition(st)
    onScroll?.(st)

    const totalHeight = containerRef.current.scrollHeight
    const viewport = containerRef.current.clientHeight
    const approxPage = Math.floor((st / Math.max(1, totalHeight - viewport)) * totalPages)
    setCurrentPage(Math.max(0, Math.min(approxPage, totalPages - 1)))
  }, [setScrollPosition, setCurrentPage, totalPages, onScroll])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // ── Highlight creation ────────────────────────────────────────────────────
  const handleHighlight = useCallback((highlight) => {
    // Viewers cannot create highlights
    if (!canInteract || !currentBookId) return
    addHighlight(currentBookId, highlight)
    // Broadcast to room members
    onSyncHighlight?.(currentBookId, highlight)
  }, [canInteract, currentBookId, addHighlight, onSyncHighlight])

  const handlePageVisible = useCallback((pageIndex) => {
    setVisiblePage(pageIndex)
    setCurrentPage(pageIndex)
  }, [setCurrentPage])

  // Responsive scale: fit pages to the container width, then apply user font-size preference
  const PADDING = 32  // px-4 on both sides = 32px total
  const userFontScale = (preferences.fontSize || 16) / 16
  const availW = containerWidth > 0 ? containerWidth - PADDING : 760
  const autoScale = availW / NATURAL_PDF_WIDTH
  const scale = Math.max(0.4, Math.min(2.5, autoScale * userFontScale))

  if (!pdfDocument) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        <div className="text-center space-y-3">
          <div className="text-5xl">📄</div>
          <p className="text-sm">No document loaded</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto h-full ${focusBlur ? 'focus-blur-active' : ''}`}
      style={{ background: 'var(--surface-1)' }}
    >
      {rulerEnabled && <ReadingRuler containerRef={containerRef} />}

      <div
        className="py-4 sm:py-6 px-4 mx-auto w-full"
        style={{ maxWidth: 900 }}
      >
        {Array.from({ length: totalPages }, (_, i) => (
          <VirtualPage
            key={i}
            pdfDoc={pdfDocument}
            pageIndex={i}
            scale={scale}
            highlights={getHighlightsForPage(currentBookId, i)}
            bookId={currentBookId}
            onHighlight={canInteract ? handleHighlight : null}
            onVisible={handlePageVisible}
            estimatedHeight={pageHeights[i] || 1100}
            canInteract={canInteract}
          />
        ))}

        {totalPages > 0 && (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            End of document — {totalPages} pages
          </div>
        )}
      </div>

      {/* Annotation toolbar — only for owners/readers */}
      {canInteract && toolbarPosition && selectedText && (
        <AnnotationToolbar
          position={toolbarPosition}
          onHighlight={(color) => {
            const hl = {
              id: `hl_${Date.now()}`,
              bookId: currentBookId,
              pageIndex: selectedText.pageIndex,
              text: selectedText.text,
              color,
              rects: selectedText.rects,
              createdAt: Date.now(),
            }
            handleHighlight(hl)
            clearSelection()
            window.getSelection()?.removeAllRanges()
          }}
          onClose={clearSelection}
        />
      )}

      {/* View-only indicator for viewers */}
      {!canInteract && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 text-white text-[11px] font-medium backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            View only · Owner controls the reading
          </div>
        </div>
      )}
    </div>
  )
}
