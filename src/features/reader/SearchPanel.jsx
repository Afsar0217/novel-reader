import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronUp, ChevronDown, Loader } from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { searchPDFText } from '../../services/pdfService'
import { IconButton } from '../../components/UI/Button'
import { truncate, highlightSearchMatch } from '../../utils/textUtils'

export const SearchPanel = ({ open, onClose }) => {
  const { pdfDocument, setCurrentPage } = useReaderStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [resultIndex, setResultIndex] = useState(0)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    else {
      setQuery('')
      setResults([])
    }
  }, [open])

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !pdfDocument) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setResults([])
    try {
      const found = await searchPDFText(pdfDocument, q, controller.signal)
      if (!controller.signal.aborted) {
        setResults(found)
        setResultIndex(0)
        if (found.length > 0) setCurrentPage(found[0].pageIndex)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [pdfDocument, setCurrentPage])

  useEffect(() => {
    const timer = setTimeout(() => { if (query.length >= 2) doSearch(query) }, 400)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const navigate = (dir) => {
    if (!results.length) return
    const next = (resultIndex + dir + results.length) % results.length
    setResultIndex(next)
    setCurrentPage(results[next].pageIndex)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
        >
          <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              {loading
                ? <Loader size={16} className="text-accent animate-spin flex-shrink-0" />
                : <Search size={16} className="text-[var(--text-muted)] flex-shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                placeholder="Search in document…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1)
                  if (e.key === 'Escape') onClose()
                }}
                className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              {results.length > 0 && (
                <span className="text-xs text-[var(--text-muted)] tabular-nums flex-shrink-0">
                  {resultIndex + 1}/{results.length}
                </span>
              )}
              <div className="flex gap-1">
                <IconButton onClick={() => navigate(-1)} disabled={!results.length} variant="ghost">
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton onClick={() => navigate(1)} disabled={!results.length} variant="ghost">
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton onClick={onClose} variant="ghost">
                  <X size={14} />
                </IconButton>
              </div>
            </div>

            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                {results.slice(0, 30).map((r, i) => (
                  <button
                    key={i}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)]/50 last:border-0 ${
                      i === resultIndex ? 'bg-accent/8' : ''
                    }`}
                    onClick={() => {
                      setResultIndex(i)
                      setCurrentPage(r.pageIndex)
                    }}
                  >
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-0.5">
                      <span className="font-medium">Page {r.pageIndex + 1}</span>
                    </div>
                    <p
                      className="text-xs text-[var(--text-secondary)] leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: highlightSearchMatch(truncate(r.context, 100), query),
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                No matches found for "{query}"
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
