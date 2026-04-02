import { useState, useEffect, useRef, useCallback } from 'react'
import { renderPageToCanvas, buildTextLayerItems } from '../services/pdfService'

export const usePDFPage = (pdfDoc, pageIndex, scale, enabled = true) => {
  const canvasRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [textLayer, setTextLayer] = useState(null)
  const [isRendered, setIsRendered] = useState(false)
  const [error, setError] = useState(null)
  const renderingRef = useRef(false)

  const render = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !enabled || renderingRef.current) return
    renderingRef.current = true
    setError(null)

    try {
      const page = await pdfDoc.getPage(pageIndex + 1)
      const dims = await renderPageToCanvas(page, canvasRef.current, scale)
      if (dims) setDimensions(dims)

      const tl = await buildTextLayerItems(page, scale)
      setTextLayer(tl)
      setIsRendered(true)
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') {
        setError(e?.message || 'Render failed')
      }
    } finally {
      renderingRef.current = false
    }
  }, [pdfDoc, pageIndex, scale, enabled])

  useEffect(() => {
    if (enabled) {
      setIsRendered(false)
      render()
    }
    return () => { renderingRef.current = false }
  }, [render, enabled])

  return { canvasRef, dimensions, textLayer, isRendered, error }
}

export const useIntersectionObserver = (callback, options = {}) => {
  const ref = useRef(null)
  const observerRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => callback(entry))
    }, {
      threshold: 0.01,
      rootMargin: '200px 0px',
      ...options,
    })

    observerRef.current.observe(ref.current)
    return () => observerRef.current?.disconnect()
  }, [callback, options.root])

  return ref
}

export const useVirtualPages = (totalPages, containerRef, pageHeights, gap = 16) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(3, totalPages) })
  const OVERSCAN = 2

  useEffect(() => {
    if (!containerRef.current || !totalPages) return

    const container = containerRef.current

    const updateVisible = () => {
      const scrollTop = container.scrollTop
      const viewportHeight = container.clientHeight
      const viewportBottom = scrollTop + viewportHeight

      let accum = 0
      let start = 0
      let end = totalPages - 1

      for (let i = 0; i < totalPages; i++) {
        const h = (pageHeights[i] || 800) + gap
        if (accum + h < scrollTop && i < totalPages - 1) {
          start = i + 1
        }
        if (accum > viewportBottom && end === totalPages - 1) {
          end = i
        }
        accum += h
      }

      const safeStart = Math.max(0, start - OVERSCAN)
      const safeEnd = Math.min(totalPages - 1, end + OVERSCAN)

      setVisibleRange(prev => {
        if (prev.start === safeStart && prev.end === safeEnd) return prev
        return { start: safeStart, end: safeEnd }
      })
    }

    updateVisible()
    container.addEventListener('scroll', updateVisible, { passive: true })
    return () => container.removeEventListener('scroll', updateVisible)
  }, [totalPages, containerRef, pageHeights, gap])

  return visibleRange
}
