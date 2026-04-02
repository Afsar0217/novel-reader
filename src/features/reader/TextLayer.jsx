import { useRef, memo } from 'react'
import { useTextSelection } from '../../hooks/useTextSelection'
import { useAnnotationStore } from '../../store/annotationStore'

const HIGHLIGHT_COLORS_CSS = {
  yellow: 'rgba(254, 240, 138, 0.75)',
  blue:   'rgba(191, 219, 254, 0.75)',
  green:  'rgba(187, 247, 208, 0.75)',
  pink:   'rgba(251, 207, 232, 0.75)',
  purple: 'rgba(233, 213, 255, 0.75)',
}

export const TextLayer = memo(({ textLayer, pageIndex, highlights = [], bookId, onHighlight, dimensions }) => {
  const containerRef = useRef(null)
  const { toolbarPosition, selectedText } = useAnnotationStore()
  const { createHighlight } = useTextSelection(containerRef, pageIndex, bookId, onHighlight)

  if (!textLayer?.items) return null

  const { items, viewport } = textLayer

  return (
    <div
      ref={containerRef}
      className="pdf-text-layer"
      style={{ width: dimensions?.width, height: dimensions?.height }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            fontSize: `${item.fontSize}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            transform: item.angle !== 0 ? `rotate(${item.angle}deg)` : undefined,
            lineHeight: '1',
            position: 'absolute',
            whiteSpace: 'pre',
            cursor: 'text',
            color: 'transparent',
            userSelect: 'text',
          }}
          data-item-index={i}
        >
          {item.str}
        </span>
      ))}

      {highlights.map((hl) => (
        hl.rects?.map((rect, ri) => (
          <div
            key={`${hl.id}_${ri}`}
            className="absolute pointer-events-none animate-highlight-glow"
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.width}px`,
              height: `${rect.height + 2}px`,
              backgroundColor: HIGHLIGHT_COLORS_CSS[hl.color] || HIGHLIGHT_COLORS_CSS.yellow,
              borderRadius: 2,
              mixBlendMode: 'multiply',
            }}
            title={hl.text}
          />
        ))
      ))}
    </div>
  )
})

TextLayer.displayName = 'TextLayer'

export const AnnotationToolbar = ({ position, onHighlight, onClose }) => {
  if (!position) return null

  const colors = [
    { key: 'yellow', bg: '#fef08a', label: 'Yellow' },
    { key: 'blue',   bg: '#bfdbfe', label: 'Blue' },
    { key: 'green',  bg: '#bbf7d0', label: 'Green' },
    { key: 'pink',   bg: '#fbcfe8', label: 'Pink' },
    { key: 'purple', bg: '#e9d5ff', label: 'Purple' },
  ]

  return (
    <div
      className="annotation-toolbar"
      style={{ left: position.x - 100, top: position.y - 52 }}
    >
      <span className="text-xs text-[var(--text-muted)] px-1 mr-1">Highlight:</span>
      {colors.map(c => (
        <button
          key={c.key}
          title={c.label}
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: c.bg }}
          onMouseDown={(e) => {
            e.preventDefault()
            onHighlight(c.key)
          }}
        />
      ))}
      <div className="w-px h-4 bg-[var(--border)] mx-1" />
      <button
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded hover:bg-[var(--surface-2)]"
        onMouseDown={(e) => { e.preventDefault(); onClose?.() }}
      >
        ✕
      </button>
    </div>
  )
}
