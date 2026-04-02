import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Upload, X, Users } from 'lucide-react'
import { useRoomStore } from '../../store/roomStore'

const fmtSize = (b) => {
  if (!b) return ''
  if (b < 1024 * 1024) return ` · ${(b / 1024).toFixed(0)} KB`
  return ` · ${(b / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Floating prompt shown to visitors when the room owner opens a PDF.
 * The visitor uploads the same PDF file, and the app auto-matches by bookId
 * (filename + size hash) so sync starts immediately.
 */
export const BookRequestPrompt = ({ onFileSelected }) => {
  const { requestedBook, clearRequestedBook } = useRoomStore()
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected?.(file)
    e.target.value = ''
  }

  return (
    <AnimatePresence>
      {requestedBook && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{   opacity: 0, y: 80, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-[var(--surface-0)] border border-accent/30 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden">

            {/* Top accent bar */}
            <div className="h-1 bg-gradient-to-r from-accent via-purple-400 to-pink-400" />

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Users size={11} className="text-[var(--text-muted)]" />
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      {requestedBook.fromUsername} opened a book
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">
                    {requestedBook.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {requestedBook.filename}{fmtSize(requestedBook.size)}
                  </p>
                </div>
                <button
                  onClick={clearRequestedBook}
                  className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] flex-shrink-0 -mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Instruction */}
              <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
                Upload <span className="font-semibold text-[var(--text-primary)]">the same PDF file</span> on
                your device to start reading in sync. Your pages, highlights and scroll will stay perfectly matched.
              </p>

              {/* Upload button */}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all shadow-sm shadow-accent/25"
              >
                <Upload size={15} />
                Upload "{requestedBook.filename || 'the same PDF'}"
              </button>

              {/* Dismiss */}
              <button
                onClick={clearRequestedBook}
                className="w-full mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] py-1 transition-colors"
              >
                Dismiss — I'll upload later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
