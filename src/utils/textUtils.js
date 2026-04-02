/**
 * Groups raw PDF text items into paragraphs using heuristics:
 * - Items on same line merged
 * - New paragraph when vertical gap > threshold
 */
export const groupTextItemsIntoParagraphs = (textItems, viewport) => {
  if (!textItems || textItems.length === 0) return []

  const lineHeight = estimateLineHeight(textItems)
  const lines = []
  let currentLine = []
  let lastY = null

  const sorted = [...textItems].sort((a, b) => {
    const ay = viewport.height - a.transform[5]
    const by = viewport.height - b.transform[5]
    return ay !== by ? ay - by : a.transform[4] - b.transform[4]
  })

  for (const item of sorted) {
    const y = viewport.height - item.transform[5]
    if (lastY === null || Math.abs(y - lastY) < lineHeight * 0.6) {
      currentLine.push(item)
    } else {
      if (currentLine.length) lines.push([...currentLine])
      currentLine = [item]
    }
    lastY = y
  }
  if (currentLine.length) lines.push(currentLine)

  const paragraphs = []
  let current = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const y = viewport.height - line[0].transform[5]
    const prevY = i > 0 ? viewport.height - lines[i - 1][0].transform[5] : y

    if (i > 0 && y - prevY > lineHeight * 1.8) {
      if (current.length) paragraphs.push(current)
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) paragraphs.push(current)

  return paragraphs.map((lines, i) => ({
    id: i,
    text: lines.map(l => l.map(item => item.str).join(' ')).join(' '),
    lines,
  }))
}

const estimateLineHeight = (items) => {
  const heights = items
    .map(item => item.height || (item.transform && Math.abs(item.transform[3])) || 12)
    .filter(h => h > 0)
  if (!heights.length) return 16
  heights.sort((a, b) => a - b)
  return heights[Math.floor(heights.length / 2)] * 1.3
}

export const countWords = (text) => {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export const estimateReadingTime = (wordCount, wpm = 238) => {
  const minutes = wordCount / wpm
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m`
}

export const sanitizeText = (str) => {
  if (!str) return ''
  return str.replace(/\u0000/g, '').trim()
}

export const truncate = (str, maxLen = 60) => {
  if (!str || str.length <= maxLen) return str
  return str.slice(0, maxLen).trim() + '…'
}

export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const highlightSearchMatch = (text, query) => {
  if (!query) return text
  const escaped = escapeRegex(query)
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}
