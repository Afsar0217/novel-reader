import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookMarked, Trash2, Download, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { useAnnotationStore } from '../../store/annotationStore'
import { useReaderStore } from '../../store/readerStore'
import { IconButton, Button } from '../../components/UI/Button'
import { HIGHLIGHT_COLORS } from '../../utils/colorUtils'
import { truncate } from '../../utils/textUtils'

const ColorDot = ({ color }) => (
  <div
    className="w-3 h-3 rounded-full flex-shrink-0"
    style={{ backgroundColor: HIGHLIGHT_COLORS[color]?.bg || '#fef08a' }}
  />
)

const HighlightCard = ({ highlight, bookId, onJumpTo }) => {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const { removeHighlight, addComment, getCommentsForHighlight } = useAnnotationStore()
  const comments = getCommentsForHighlight(highlight.id)

  const handleAddComment = () => {
    if (!commentText.trim()) return
    addComment(highlight.id, {
      id: `c_${Date.now()}`,
      text: commentText.trim(),
      author: 'You',
      createdAt: Date.now(),
    })
    setCommentText('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-[var(--border)] bg-[var(--surface-0)] overflow-hidden hover:shadow-[var(--shadow-sm)] transition-shadow"
    >
      <div
        className="px-3 py-2.5 cursor-pointer"
        style={{ borderLeft: `3px solid ${HIGHLIGHT_COLORS[highlight.color]?.bg || '#fef08a'}` }}
        onClick={() => onJumpTo(highlight.pageIndex)}
      >
        <div className="flex items-start gap-2">
          <ColorDot color={highlight.color} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              "{truncate(highlight.text, 80)}"
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Page {highlight.pageIndex + 1}
              {comments.length > 0 && ` · ${comments.length} note${comments.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-accent"
              onClick={(e) => { e.stopPropagation(); setShowComments(s => !s) }}
              title="Add note"
            >
              <MessageSquare size={12} />
            </button>
            <button
              className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500"
              onClick={(e) => { e.stopPropagation(); removeHighlight(bookId, highlight.id) }}
              title="Remove"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-3 py-2 space-y-2">
              {comments.map(comment => (
                <div key={comment.id} className="text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{comment.author}: </span>
                  <span className="text-[var(--text-muted)]">{comment.text}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a note…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 text-xs bg-[var(--surface-2)] rounded-lg px-2 py-1.5 outline-none focus:ring-1 ring-accent/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
                <button
                  onClick={handleAddComment}
                  className="text-xs px-2 py-1 rounded-lg bg-accent text-white hover:bg-accent/90"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export const HighlightPanel = ({ open, onClose }) => {
  const { currentBookId, setCurrentPage } = useReaderStore()
  const { getHighlightsForBook, exportHighlights } = useAnnotationStore()
  const [groupByPage, setGroupByPage] = useState(true)

  if (!open) return null

  const highlights = getHighlightsForBook(currentBookId)
  const sortedHighlights = [...highlights].sort((a, b) => a.pageIndex - b.pageIndex)

  const grouped = groupByPage
    ? sortedHighlights.reduce((acc, h) => {
        const key = `Page ${h.pageIndex + 1}`
        if (!acc[key]) acc[key] = []
        acc[key].push(h)
        return acc
      }, {})
    : { 'All Highlights': sortedHighlights }

  const handleExport = () => {
    const data = exportHighlights(currentBookId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `highlights_${currentBookId}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <BookMarked size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Highlights
            {highlights.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                ({highlights.length})
              </span>
            )}
          </h3>
        </div>
        <div className="flex gap-1">
          {highlights.length > 0 && (
            <>
              <button
                onClick={() => setGroupByPage(s => !s)}
                className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
              >
                {groupByPage ? 'Flat' : 'Grouped'}
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
                title="Export highlights"
              >
                <Download size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {highlights.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <BookMarked size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No highlights yet</p>
            <p className="text-xs mt-1">Select text to highlight it</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([group, groupHighlights]) => (
              <div key={group}>
                {groupByPage && (
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2 px-1">
                    {group}
                  </p>
                )}
                <div className="space-y-2">
                  {groupHighlights.map(h => (
                    <HighlightCard
                      key={h.id}
                      highlight={h}
                      bookId={currentBookId}
                      onJumpTo={(page) => setCurrentPage(page)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
