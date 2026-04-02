import { useEffect, useCallback, useRef } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { generateHighlightId } from '../utils/idGenerator'

export const useTextSelection = (containerRef, pageIndex, bookId, onHighlight) => {
  const { setSelectedText, setToolbarPosition, clearSelection } = useAnnotationStore()
  const selectionRef = useRef(null)

  const getSelectionInfo = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return null

    const text = selection.toString().trim()
    if (text.length < 2) return null

    const range = selection.getRangeAt(0)
    const rects = Array.from(range.getClientRects())
    if (!rects.length) return null

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return null

    const firstRect = rects[0]
    const lastRect = rects[rects.length - 1]

    return {
      text,
      pageIndex,
      rects: rects.map(r => ({
        x: r.left - containerRect.left,
        y: r.top - containerRect.top,
        width: r.width,
        height: r.height,
      })),
      toolbarX: (firstRect.left + lastRect.right) / 2,
      toolbarY: firstRect.top - 8,
    }
  }, [containerRef, pageIndex])

  const handleSelectionChange = useCallback(() => {
    const info = getSelectionInfo()
    if (info) {
      selectionRef.current = info
      setSelectedText(info)
      setToolbarPosition({ x: info.toolbarX, y: info.toolbarY })
    }
  }, [getSelectionInfo, setSelectedText, setToolbarPosition])

  const handleMouseUp = useCallback(() => {
    setTimeout(handleSelectionChange, 10)
  }, [handleSelectionChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchend', handleMouseUp)
    return () => {
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchend', handleMouseUp)
    }
  }, [handleMouseUp, containerRef])

  const createHighlight = useCallback((color = 'yellow') => {
    const info = selectionRef.current
    if (!info || !bookId) return null

    const highlight = {
      id: generateHighlightId(),
      bookId,
      pageIndex: info.pageIndex,
      text: info.text,
      color,
      rects: info.rects,
      note: '',
      createdAt: Date.now(),
    }

    onHighlight?.(highlight)
    clearSelection()
    window.getSelection()?.removeAllRanges()
    selectionRef.current = null
    return highlight
  }, [bookId, onHighlight, clearSelection])

  return { createHighlight }
}
