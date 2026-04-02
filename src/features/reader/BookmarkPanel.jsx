import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, BookmarkCheck, Trash2, Edit3, Check, X, Plus, ChevronRight } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/* ── Inline label editor ── */
const EditLabel = ({ value, onSave, onCancel }) => {
  const [v, setV] = useState(value)
  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        autoFocus
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(v); if (e.key === 'Escape') onCancel() }}
        maxLength={60}
        className="flex-1 text-xs bg-[var(--surface-2)] border border-accent/40 rounded-lg px-2 py-1 outline-none text-[var(--text-primary)]"
      />
      <button onClick={() => onSave(v)} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
        <Check size={12} />
      </button>
      <button onClick={onCancel} className="p-1 text-[var(--text-muted)] hover:bg-[var(--surface-3)] rounded-lg">
        <X size={12} />
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════
   BOOKMARK PANEL
════════════════════════════════════════════ */
export const BookmarkPanel = ({ open, onClose, onJumpToPage }) => {
  const {
    currentPage, totalPages,
    addBookmark, removeBookmark, updateBookmarkLabel,
    getBookmarks, isPageBookmarked,
  } = useReaderStore()

  const [editingId, setEditingId]   = useState(null)
  const [addingLabel, setAddingLabel] = useState(false)
  const [labelDraft, setLabelDraft]  = useState('')

  const bookmarks = getBookmarks()
  const currentBookmarked = isPageBookmarked(currentPage)

  const handleAdd = () => {
    const label = labelDraft.trim() || `Page ${currentPage + 1}`
    addBookmark(label)
    setLabelDraft('')
    setAddingLabel(false)
  }

  const handleRemoveCurrent = () => {
    const bm = bookmarks.find(b => b.page === currentPage)
    if (bm) removeBookmark(bm.id)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          className="absolute right-2 sm:right-4 z-40 bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] w-72"
          style={{ top: '3.25rem' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[var(--border)]">
            <Bookmark size={14} className="text-accent" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex-1">Bookmarks</h3>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
              {bookmarks.length}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
              <X size={14} />
            </button>
          </div>

          {/* Current page action */}
          <div className="px-3 py-3 border-b border-[var(--border)]">
            {currentBookmarked ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <BookmarkCheck size={12} /> Page {currentPage + 1} is bookmarked
                  </p>
                </div>
                <button
                  onClick={handleRemoveCurrent}
                  className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-500/8 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            ) : (
              <div>
                {addingLabel ? (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Label for page {currentPage + 1}</p>
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        value={labelDraft}
                        onChange={e => setLabelDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingLabel(false) }}
                        placeholder={`Page ${currentPage + 1}`}
                        maxLength={60}
                        className="flex-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] focus:border-accent/50 rounded-xl px-3 py-1.5 outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                      />
                      <button onClick={handleAdd} className="px-3 py-1.5 bg-accent text-white rounded-xl text-xs font-medium hover:bg-accent/90">
                        Save
                      </button>
                      <button onClick={() => setAddingLabel(false)} className="px-2 py-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingLabel(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-accent/40 hover:bg-accent/5 text-xs text-[var(--text-muted)] hover:text-accent transition-all"
                  >
                    <Plus size={13} />
                    Bookmark page {currentPage + 1}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bookmark list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {bookmarks.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <Bookmark size={28} className="text-[var(--surface-3)]" />
                <p className="text-xs text-[var(--text-muted)]">No bookmarks yet</p>
              </div>
            ) : (
              <ul className="px-2 pb-2">
                {bookmarks.map(bm => (
                  <li key={bm.id}>
                    <div
                      className={`flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer group transition-colors ${
                        bm.page === currentPage
                          ? 'bg-accent/8 border border-accent/15'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                      onClick={() => { onJumpToPage?.(bm.page); onClose?.() }}
                    >
                      {/* Page badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        bm.page === currentPage ? 'bg-accent text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]'
                      }`}>
                        {bm.page + 1}
                      </div>

                      {/* Label + date */}
                      <div className="flex-1 min-w-0">
                        {editingId === bm.id ? (
                          <EditLabel
                            value={bm.label}
                            onSave={label => { updateBookmarkLabel(bm.id, label); setEditingId(null) }}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <>
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{bm.label}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{formatDate(bm.createdAt)}</p>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      {editingId !== bm.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(bm.id) }}
                            className="p-1 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)]"
                            title="Edit label"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); removeBookmark(bm.id) }}
                            className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500"
                            title="Remove"
                          >
                            <Trash2 size={11} />
                          </button>
                          <ChevronRight size={11} className="text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Tiny bookmark toggle button (for top bar) ── */
export const BookmarkToggle = ({ onClick }) => {
  const { currentPage, isPageBookmarked } = useReaderStore()
  const bookmarked = isPageBookmarked(currentPage)

  return (
    <button
      onClick={onClick}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      className={`p-1.5 rounded-xl transition-all ${
        bookmarked
          ? 'text-accent bg-accent/10 hover:bg-accent/20'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
    </button>
  )
}
