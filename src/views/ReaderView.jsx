import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReaderStore }  from '../store/readerStore'
import { useUserStore }    from '../store/userStore'
import { useRoomStore }    from '../store/roomStore'
import { useChatStore }    from '../store/chatStore'
import { loadPDFFromBuffer } from '../services/pdfService'
import { startAmbientAudio, stopAmbientAudio } from '../services/audioService'
import { socketService }   from '../services/socketService'
import { usePresence }     from '../hooks/usePresence'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { PDFRenderer }     from '../features/reader/PDFRenderer'
import { BookView }        from '../features/reader/BookView'
import { ReaderTopBar, ReaderBottomBar } from '../features/reader/ReaderControls'
import { SearchPanel }     from '../features/reader/SearchPanel'
import { BookmarkPanel }   from '../features/reader/BookmarkPanel'
import { RoomPanel }       from '../features/rooms/RoomPanel'
import { RoomChat }        from '../features/rooms/RoomChat'
import { ReaderSidebar }   from '../components/Layout/Sidebar'
import { RemoteCursors }   from '../features/rooms/UserPresence'
import { Spinner }         from '../components/UI/Tooltip'

export const ReaderView = ({
  bookId, pdfBuffer, onBack,
  sendScroll, sendPageChange, sendCursor, sendHighlight,
  sendChatMessage, setChatPanelOpen,
}) => {
  const {
    pdfDocument, setPdfDocument, setLoadError,
    isLoading, loadError, currentPage, setCurrentPage,
    setScrollPosition, setTotalPages, getCurrentBook,
    addBookmark, removeBookmark, isPageBookmarked, bookmarks, currentBookId,
  } = useReaderStore()
  const { preferences, toggleSyncLocked, toggleAmbient, user } = useUserStore()
  const { currentRoom } = useRoomStore()

  const [showSearch,    setShowSearch]    = useState(false)
  const [showSidebar,   setShowSidebar]   = useState(false)
  const [showRoomPanel, setShowRoomPanel] = useState(false)
  const [showRoomChat,  setShowRoomChat]  = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  const containerRef = useRef(null)
  const book  = getCurrentBook()
  const inRoom = !!currentRoom

  /* ── Role: only the active controller can drive reading ──────── */
  const isController = inRoom
    ? currentRoom.activeControllerId === user?.clientId
    : true   // solo reading — full control
  const canInteract = isController

  const { getUnread } = useChatStore()
  const unreadChat = inRoom && currentRoom ? getUnread(currentRoom.roomId) : 0

  usePresence(sendCursor)

  /* ── Swipe hint (mobile, once per session) ───────────────────── */
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width:640px)').matches
    if (isMobile && !sessionStorage.getItem('swipeHintShown')) {
      const t = setTimeout(() => {
        setShowSwipeHint(true)
        setTimeout(() => setShowSwipeHint(false), 3000)
        sessionStorage.setItem('swipeHintShown', '1')
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [])

  /* ── Load PDF ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!pdfBuffer || !bookId) return
    let cancelled = false
    loadPDFFromBuffer(pdfBuffer, bookId)
      .then(doc => {
        if (!cancelled) { setPdfDocument(doc); setTotalPages(doc.numPages) }
      })
      .catch(e => { if (!cancelled) setLoadError(e?.message || 'Failed to load PDF') })
    return () => { cancelled = true }
  }, [pdfBuffer, bookId])

  /* ── Ambient audio ───────────────────────────────────────────── */
  useEffect(() => {
    if (preferences.ambientEnabled) startAmbientAudio()
    else stopAmbientAudio()
    return () => stopAmbientAudio()
  }, [preferences.ambientEnabled])

  /* ── Receive scroll from socketService (scroll mode) ─────────── */
  useEffect(() => {
    if (!inRoom || canInteract) return   // viewers only
    const unsub = socketService.on('sync:scroll', ({ scrollPosition }) => {
      if (!preferences.syncLocked || !isScrollMode) return
      containerRef.current?.scrollTo({ top: scrollPosition, behavior: 'smooth' })
    })
    return unsub
  }, [inRoom, canInteract, isScrollMode, preferences.syncLocked])

  /* ── Receive page sync (book mode → also drives scroll mode) ─── */
  useEffect(() => {
    if (!inRoom || canInteract) return   // viewers only
    const unsub = socketService.on('sync:page', ({ page }) => {
      if (!preferences.syncLocked) return
      // Book mode: setCurrentPage is already called by useSync.js → BookView re-renders ✓
      // Scroll mode: physically scroll to the page's approximate position
      if (isScrollMode && containerRef.current && pdfDocument) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return
          const approxY = (page / pdfDocument.numPages) * containerRef.current.scrollHeight
          containerRef.current.scrollTo({ top: approxY, behavior: 'smooth' })
        })
      }
    })
    return unsub
  }, [inRoom, canInteract, isScrollMode, preferences.syncLocked, pdfDocument])

  /* ── Scroll handler ──────────────────────────────────────────── */
  const handleScroll = useCallback((scrollPos) => {
    setScrollPosition(scrollPos)
    if (inRoom && canInteract && preferences.syncLocked) sendScroll(scrollPos)
  }, [inRoom, canInteract, preferences.syncLocked, sendScroll, setScrollPosition])

  /* ── Broadcast page changes ──────────────────────────────────── */
  useEffect(() => {
    if (!inRoom || !pdfDocument || !canInteract) return
    if (preferences.syncLocked) sendPageChange(currentPage)
  }, [currentPage, pdfDocument])

  /* ── Navigation helpers ──────────────────────────────────────── */
  const goToPrevPage = useCallback(() => {
    if (!canInteract || !containerRef.current) return
    setCurrentPage(Math.max(0, currentPage - 1))
    containerRef.current.scrollBy({ top: -containerRef.current.clientHeight * 0.85, behavior: 'smooth' })
  }, [canInteract, currentPage, setCurrentPage])

  const goToNextPage = useCallback(() => {
    if (!canInteract || !containerRef.current) return
    const max = (pdfDocument?.numPages ?? 1) - 1
    setCurrentPage(Math.min(max, currentPage + 1))
    containerRef.current.scrollBy({ top: containerRef.current.clientHeight * 0.85, behavior: 'smooth' })
  }, [canInteract, currentPage, setCurrentPage, pdfDocument])

  const goToPage = useCallback((page) => {
    if (!canInteract) return
    setCurrentPage(page)
    if (containerRef.current) {
      const h = containerRef.current.scrollHeight / (pdfDocument?.numPages || 1)
      containerRef.current.scrollTo({ top: page * h, behavior: 'smooth' })
    }
  }, [canInteract, setCurrentPage, pdfDocument])

  /* ── Swipe gesture ───────────────────────────────────────────── */
  const isScrollMode = preferences.readingMode !== 'book'
  useSwipeGesture(isScrollMode && canInteract ? containerRef : { current: null }, {
    onSwipeLeft:  goToNextPage,
    onSwipeRight: goToPrevPage,
  })

  /* ── Keyboard shortcuts ──────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')  { e.preventDefault(); goToNextPage() }
      if (e.key === 'ArrowUp'   || e.key === 'PageUp')  { e.preventDefault(); goToPrevPage() }
      if (e.key === '/' || (e.ctrlKey && e.key === 'f')) { e.preventDefault(); setShowSearch(s => !s) }
      if (e.key === 'Escape') { setShowSearch(false); setShowRoomPanel(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToNextPage, goToPrevPage])

  /* ── Loading state ───────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface-0)] gap-4">
        <Spinner size={36} />
        <p className="text-sm text-[var(--text-muted)] animate-pulse">Loading document…</p>
      </div>
    )
  }

  /* ── Error state ─────────────────────────────────────────────── */
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface-0)] gap-4 px-6 text-center">
        <div className="text-5xl">⚠️</div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Failed to load PDF</p>
        <p className="text-sm text-red-500 max-w-xs">{loadError}</p>
        <button onClick={onBack}
          className="mt-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--surface-0)] overflow-hidden">

      {/* Top bar */}
      <div className="relative flex-shrink-0 z-30">
        <ReaderTopBar
          title={book?.title}
          onBack={onBack}
          onOpenSearch={() => setShowSearch(s => !s)}
          onToggleSidebar={() => setShowSidebar(s => !s)}
          onToggleRoomPanel={() => setShowRoomPanel(s => !s)}
          onToggleRoomChat={() => { setShowRoomChat(s => !s); setShowRoomPanel(false) }}
          onToggleBookmarks={() => setShowBookmarks(s => !s)}
          inRoom={inRoom}
          sidebarOpen={showSidebar}
          roomPanelOpen={showRoomPanel}
          roomChatOpen={showRoomChat}
          bookmarksOpen={showBookmarks}
          unreadChat={unreadChat}
        />
        <SearchPanel open={showSearch} onClose={() => setShowSearch(false)} />
        <BookmarkPanel open={showBookmarks} onClose={() => setShowBookmarks(false)} onJumpToPage={goToPage} />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        <main className="flex-1 relative overflow-hidden">
          {preferences.readingMode === 'book'
            ? <BookView
                canInteract={canInteract}
                onSyncHighlight={sendHighlight}
                onPageChange={(p) => {
                  if (!canInteract) return
                  if (inRoom && preferences.syncLocked) sendPageChange(p)
                }}
              />
            : <PDFRenderer
                onScroll={handleScroll}
                readingContainerRef={containerRef}
                canInteract={canInteract}
                onSyncHighlight={sendHighlight}
              />
          }
        </main>

        {/* Highlights / Analytics sidebar */}
        <ReaderSidebar open={showSidebar} onClose={() => setShowSidebar(false)} />

        {/* Room panel */}
        <RoomPanel open={showRoomPanel && inRoom} onClose={() => setShowRoomPanel(false)} />

        {/* Room chat */}
        <RoomChat
          open={showRoomChat && inRoom}
          onClose={() => setShowRoomChat(false)}
          sendChatMessage={sendChatMessage}
          setChatPanelOpen={setChatPanelOpen}
        />
      </div>

      {/* Bottom bar */}
      <ReaderBottomBar
        onPrevPage={goToPrevPage}
        onNextPage={goToNextPage}
        onOpenChat={() => { setShowRoomChat(s => !s); setShowRoomPanel(false) }}
        onToggleBookmark={() => {
          if (isPageBookmarked(currentPage)) {
            const bm = (bookmarks[currentBookId] || []).find(b => b.page === currentPage)
            if (bm) removeBookmark(bm.id)
          } else {
            addBookmark()
          }
        }}
        inRoom={inRoom}
        unreadChat={unreadChat}
      />

      {/* Remote cursors overlay */}
      {inRoom && <RemoteCursors />}

      {/* Ambient audio indicator */}
      <AnimatePresence>
        {preferences.ambientEnabled && (
          <motion.div
            initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
            className="fixed bottom-14 right-3 z-20 w-3 h-3 rounded-full bg-purple-400 ambient-indicator cursor-pointer"
            title="Ambient sound — click to stop"
            onClick={toggleAmbient}
          />
        )}
      </AnimatePresence>

      {/* Swipe hint */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-xs px-4 py-2 rounded-full pointer-events-none">
            👈 Swipe to navigate pages 👉
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
