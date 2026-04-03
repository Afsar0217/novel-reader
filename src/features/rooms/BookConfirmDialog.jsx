/**
 * BookConfirmDialog — shown to viewers inside the reader when owner
 * changes the book mid-session (rare but possible).
 * The main confirmation flow (before reading starts) is in LobbyView.
 * This dialog handles the case where a new participant joins while
 * reading is already in progress.
 */
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence }  from 'framer-motion'
import { Upload, BookOpen, Loader2, X, CheckCircle2 } from 'lucide-react'
import { useRoomStore }   from '../../store/roomStore'
import { useReaderStore } from '../../store/readerStore'
import { socketService }  from '../../services/socketService'
import { storePDF }       from '../../services/storageService'
import { generateBookId } from '../../utils/idGenerator'

export const BookConfirmDialog = ({ book, onConfirmed, onDismiss }) => {
  const [state,  setState]  = useState('idle')   // idle | uploading | matched | mismatch | done
  const [error,  setError]  = useState('')
  const fileRef = useRef(null)
  const { addBook } = useReaderStore()

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) { setError('Please select a PDF'); return }
    setState('uploading'); setError('')
    try {
      const buffer = await file.arrayBuffer()
      const bookId = generateBookId(file.name, file.size)

      if (bookId !== book.bookId) {
        setError(`This file doesn't match. Please upload "${book.filename}" (${(book.size / 1024 / 1024).toFixed(1)} MB)`)
        setState('mismatch')
        return
      }
      const bookData = {
        id:       bookId,
        title:    file.name.replace(/\.pdf$/i, ''),
        filename: file.name,
        size:     file.size,
        addedAt:  Date.now(),
      }
      await storePDF(bookId, buffer)
      addBook({ ...bookData, arrayBuffer: buffer })
      socketService.confirmBook()
      setState('done')
      setTimeout(() => onConfirmed(bookId, buffer), 600)
    } catch (e) {
      setError(e.message || 'Upload failed')
      setState('idle')
    }
  }, [book, addBook, onConfirmed])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)' }}>
        <motion.div
          initial={{ opacity:0, scale:0.9, y:20 }}
          animate={{ opacity:1, scale:1, y:0 }}
          exit={{ opacity:0, scale:0.9 }}
          className="w-full max-w-sm bg-[var(--surface-0)] rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[var(--border)] flex items-start gap-4">
            <div className="w-12 h-14 bg-accent rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <BookOpen size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-0.5">New book selected</p>
              <p className="font-bold text-[var(--text-primary)] truncate">{book.title}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{book.filename} · {(book.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button onClick={onDismiss} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1 -mt-1">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {state === 'done' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="font-semibold text-emerald-600">PDF matched! Joining session…</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Upload the same PDF to join the reading session.
                </p>
                {error && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">{error}</p>
                )}
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()} disabled={state === 'uploading'}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-2xl font-semibold text-sm hover:bg-accent/90 disabled:opacity-60 transition-all">
                  {state === 'uploading'
                    ? <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                    : <><Upload size={15} /> Upload "{book.filename}"</>}
                </button>
                {(state === 'mismatch' || state === 'idle') && (
                  <button onClick={onDismiss}
                    className="w-full py-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-2xl border border-[var(--border)] hover:border-[var(--border-hover)] transition-all">
                    Skip (View only — no PDF)
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
