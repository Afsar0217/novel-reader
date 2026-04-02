import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReaderStore } from '../../store/readerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useUserStore } from '../../store/userStore'
import { VirtualPage } from './PageCanvas'
import { AnnotationToolbar } from './TextLayer'
import { ReadingRuler } from './ReadingRuler'

const PAGE_GAP = 24

export const PDFRenderer = ({ onScroll, readingContainerRef }) => {
  const { pdfDocument, currentPage, scrollPosition, setCurrentPage, setScrollPosition, currentBookId } = useReaderStore()
  const { addHighlight, getHighlightsForPage, toolbarPosition, selectedText, clearSelection } = useAnnotationStore()
  const { preferences } = useUserStore()
  const { syncLocked, rulerEnabled, focusBlur, readingMode } = preferences

  const internalRef = useRef(null)
  const containerRef = readingContainerRef || internalRef
  const [pageHeights, setPageHeights] = useState({})
  const [visiblePage, setVisiblePage] = useState(0)
  const scrollRestored = useRef(false)
  const totalPages = pdfDocument?.numPages || 0

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

  const handleHighlight = useCallback((highlight) => {
    if (!currentBookId) return
    addHighlight(currentBookId, highlight)
  }, [currentBookId, addHighlight])

  const handlePageVisible = useCallback((pageIndex) => {
    setVisiblePage(pageIndex)
    setCurrentPage(pageIndex)
  }, [setCurrentPage])

  const scale = Math.max(0.5, Math.min(3, (preferences.fontSize || 16) / 16 * 1.5))

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
        className="py-6 px-4 mx-auto"
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
            onHighlight={handleHighlight}
            onVisible={handlePageVisible}
            estimatedHeight={pageHeights[i] || 1100}
          />
        ))}

        {totalPages > 0 && (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            End of document — {totalPages} pages
          </div>
        )}
      </div>

      {toolbarPosition && selectedText && (
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
    </div>
  )
}
