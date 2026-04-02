import * as pdfjsLib from 'pdfjs-dist'
import PDFWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { storePDF, retrievePDF, cachePDFBuffer, getCachedPDFBuffer } from './storageService'
import { groupTextItemsIntoParagraphs } from '../utils/textUtils'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorkerUrl

const pageCache = new Map()
const renderTaskMap = new Map()

export const loadPDFFromBuffer = async (arrayBuffer, bookId) => {
  try {
    // Slice to a fresh copy — prevents "already detached" errors when the
    // same buffer is reused (e.g. React StrictMode double-invocation or retries)
    const freshBuffer = arrayBuffer.slice(0)
    const uint8 = new Uint8Array(freshBuffer)

    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
    })
    const doc = await loadingTask.promise

    if (bookId) {
      // Store original (not transferred) copy
      cachePDFBuffer(bookId, arrayBuffer)
      storePDF(bookId, arrayBuffer.slice(0)).catch(() => {})
    }

    return doc
  } catch (e) {
    throw new Error(`Failed to load PDF: ${e.message}`)
  }
}

export const loadPDFFromFile = async (file, bookId) => {
  const arrayBuffer = await file.arrayBuffer()
  return loadPDFFromBuffer(arrayBuffer, bookId)
}

export const loadPDFFromStorage = async (bookId) => {
  let buffer = getCachedPDFBuffer(bookId)
  if (!buffer) {
    buffer = await retrievePDF(bookId)
  }
  if (!buffer) return null
  return loadPDFFromBuffer(buffer, bookId)
}

export const getPageViewport = (page, scale = 1.5, rotation = 0) => {
  return page.getViewport({ scale, rotation })
}

export const renderPageToCanvas = async (page, canvas, scale = 1.5) => {
  // Key by page number only — cancels any in-progress render when scale changes
  const pageKey = `${page.pageNumber}`

  const existingTask = renderTaskMap.get(pageKey)
  if (existingTask) {
    try { existingTask.cancel() } catch {}
    renderTaskMap.delete(pageKey)
  }

  const viewport = getPageViewport(page, scale)
  const ctx = canvas.getContext('2d', { alpha: false })

  const devicePixelRatio = window.devicePixelRatio || 1
  const renderScale = scale * devicePixelRatio

  const renderViewport = getPageViewport(page, renderScale)

  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.width = Math.floor(renderViewport.width)
  canvas.height = Math.floor(renderViewport.height)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const renderContext = {
    canvasContext: ctx,
    viewport: renderViewport,
    intent: 'display',
    renderInteractiveForms: true,
  }

  const renderTask = page.render(renderContext)
  renderTaskMap.set(pageKey, renderTask)

  try {
    await renderTask.promise
    renderTaskMap.delete(pageKey)
    return { width: viewport.width, height: viewport.height }
  } catch (e) {
    renderTaskMap.delete(pageKey)
    if (e?.name !== 'RenderingCancelledException') throw e
  }
}

export const getTextContent = async (page) => {
  const cacheKey = `text_${page.pageNumber}`
  if (pageCache.has(cacheKey)) return pageCache.get(cacheKey)

  const content = await page.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  })
  pageCache.set(cacheKey, content)
  return content
}

export const buildTextLayerItems = async (page, scale = 1.5) => {
  const viewport = getPageViewport(page, scale)
  const textContent = await getTextContent(page)

  const items = textContent.items
    .filter(item => item.str && item.str.trim())
    .map((item, index) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
      const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3])
      const angle = Math.atan2(tx[1], tx[0]) * (180 / Math.PI)

      return {
        index,
        str: item.str,
        x: tx[4],
        y: tx[5] - fontHeight,
        width: item.width * (scale / (item.transform[0] || scale)),
        height: fontHeight,
        fontName: item.fontName || '',
        fontSize: fontHeight,
        angle,
        hasEOL: item.hasEOL || false,
      }
    })

  return {
    items,
    viewport,
    paragraphs: groupTextItemsIntoParagraphs(textContent.items, viewport),
  }
}

export const extractPageThumbnail = async (page, maxWidth = 120) => {
  const viewport = getPageViewport(page, 1)
  const scale = maxWidth / viewport.width
  const scaledViewport = getPageViewport(page, scale)

  const canvas = document.createElement('canvas')
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height

  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
  return canvas.toDataURL('image/jpeg', 0.7)
}

export const searchPDFText = async (doc, query, signal) => {
  if (!query || !doc) return []
  const results = []
  const lowerQuery = query.toLowerCase()

  for (let i = 1; i <= doc.numPages; i++) {
    if (signal?.aborted) break
    const page = await doc.getPage(i)
    const content = await getTextContent(page)
    const pageText = content.items.map(item => item.str).join(' ')
    const lowerPage = pageText.toLowerCase()

    let pos = 0
    while ((pos = lowerPage.indexOf(lowerQuery, pos)) !== -1) {
      const context = pageText.slice(Math.max(0, pos - 40), pos + query.length + 40)
      results.push({ pageIndex: i - 1, position: pos, context, query })
      pos += query.length
    }
  }

  return results
}

export const cancelPageRender = (pageNumber, scale) => {
  const key = `${pageNumber}_${scale}`
  const task = renderTaskMap.get(key)
  if (task) {
    try { task.cancel() } catch {}
    renderTaskMap.delete(key)
  }
}

export const clearPageCache = () => {
  pageCache.clear()
}
