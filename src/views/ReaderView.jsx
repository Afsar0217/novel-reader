import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReaderStore } from '../store/readerStore'
import { useUserStore } from '../store/userStore'
import { useRoomStore } from '../store/roomStore'
import { useChatStore } from '../store/chatStore'
import { loadPDFFromBuffer } from '../services/pdfService'
import { startAmbientAudio, stopAmbientAudio } from '../services/audioService'
import { syncService, SYNC_EVENTS } from '../services/syncService'
import { useSync } from '../hooks/useSync'
import { usePresence } from '../hooks/usePresence'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { PDFRenderer } from '../features/reader/PDFRenderer'
import { BookView } from '../features/reader/BookView'
import { ReaderTopBar, ReaderBottomBar } from '../features/reader/ReaderControls'
import { SearchPanel } from '../features/reader/SearchPanel'
import { BookmarkPanel } from '../features/reader/BookmarkPanel'
import { RoomPanel } from '../features/rooms/RoomPanel'
import { RoomChat } from '../features/rooms/RoomChat'
import { RoomManager } from '../features/rooms/RoomManager'
import { ReaderSidebar } from '../components/Layout/Sidebar'
import { RemoteCursors } from '../features/rooms/UserPresence'
import { Spinner } from '../components/UI/Tooltip'

export const ReaderView = ({ bookId, pdfBuffer, onBack, initialRoomPanelOpen = false }) => {
  const {
    pdfDocument, setPdfDocument, setLoadError,
    isLoading, loadError, currentPage, setCurrentPage,
    setScrollPosition, setTotalPages, getCurrentBook,
    addBookmark, removeBookmark, isPageBookmarked, bookmarks, currentBookId,
  } = useReaderStore()
  const { preferences, toggleSyncLocked, toggleAmbient, user } = useUserStore()
  const { currentRoom } = useRoomStore()

  const [showSearch,      setShowSearch]      = useState(false)
  const [showSidebar,     setShowSidebar]     = useState(false)
  const [showRoomPanel,   setShowRoomPanel]   = useState(false)
  const [showRoomChat,    setShowRoomChat]    = useState(false)
  const [showBookmarks,   setShowBookmarks]   = useState(false)
  const [showRoomManager, setShowRoomManager] = useState(false)
  const [showSwipeHint,   setShowSwipeHint]   = useState(false)

  const containerRef = useRef(null)
  const book = getCurrentBook()
  const inRoom = !!currentRoom

  const { sendScroll, sendPageChange, sendCursor, sendChatMessage, setChatPanelOpen, sendBookSet } = useSync()
  const { getUnread } = useChatStore()
  const unreadChat = inRoom && currentRoom ? getUnread(currentRoom.roomId) : 0
  usePresence(sendCursor)

  // Auto-open room panel on first entry into a room
  useEffect(() => {
    if (initialRoomPanelOpen && currentRoom) setShowRoomPanel(true)
  }, [initialRoomPanelOpen, currentRoom])

  // Show swipe hint on mobile (only once)
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width:640px)').matches
    const shown = sessionStorage.getItem('swipeHintShown')
    if (isMobile && !shown) {
      const t = setTimeout(() => {
        setShowSwipeHint(true)
        setTimeout(() => setShowSwipeHint(false), 3000)
        sessionStorage.setItem('swipeHintShown', '1')
      }, 1200)
      return () => clearTimeout(t)
    }
  }, [])

  // Load the PDF
  useEffect(() => {
    if (!pdfBuffer || !bookId) return
    let cancelled = false

    loadPDFFromBuffer(pdfBuffer, bookId)
      .then(doc => {
        if (!cancelled) {
          setPdfDocument(doc)
          setTotalPages(doc.numPages)
        }
      })
      .catch(e => {
        if (!cancelled) setLoadError(e?.message || 'Failed to load PDF')
      })

    return () => { cancelled = true }
  }, [pdfBuffer, bookId])

  // When PDF finishes loading and we're in a room as owner/reader,
  // broadcast the book metadata so visitors get the "upload to sync" prompt.
  useEffect(() => {
    if (!pdfDocument || !inRoom || !book) return
    const myRole = currentRoom?.roles?.[user?.clientId]
    if (myRole === 'owner' || myRole === 'reader') {
      sendBookSet(bookId, book.title, book.filename, book.size || 0)
    }
  // Only fire once when pdfDocument first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument])

  // Ambient audio
  useEffect(() => {
    if (preferences.ambientEnabled) startAmbientAudio()
    else stopAmbientAudio()
    return () => stopAmbientAudio()
  }, [preferences.ambientEnabled])

  // Scroll handler
  const handleScroll = useCallback((scrollPos) => {
    setScrollPosition(scrollPos)
    if (inRoom && preferences.syncLocked) sendScroll(scrollPos)
  }, [inRoom, preferences.syncLocked, sendScroll, setScrollPosition])

  // Broadcast page changes when in a room
  useEffect(() => {
    if (!inRoom || !pdfDocument) return
    if (preferences.syncLocked) sendPageChange(currentPage)
  }, [currentPage, pdfDocument])

  // Receive scroll from peers
  useEffect(() => {
    if (!inRoom) return
    const unsub = syncService.on(SYNC_EVENTS.SCROLL, event => {
      if (!preferences.syncLocked) return
      containerRef.current?.scrollTo({ top: event.scrollPosition, behavior: 'smooth' })
    })
    return unsub
  }, [inRoom, preferences.syncLocked])

  // Navigation helpers
  const goToPrevPage = useCallback(() => {
    if (!containerRef.current) return
    setCurrentPage(Math.max(0, currentPage - 1))
    containerRef.current.scrollBy({ top: -containerRef.current.clientHeight * 0.85, behavior: 'smooth' })
  }, [currentPage, setCurrentPage])

  const goToNextPage = useCallback(() => {
    if (!containerRef.current) return
    const max = (pdfDocument?.numPages ?? 1) - 1
    setCurrentPage(Math.min(max, currentPage + 1))
    containerRef.current.scrollBy({ top: containerRef.current.clientHeight * 0.85, behavior: 'smooth' })
  }, [currentPage, setCurrentPage, pdfDocument])

  const goToPage = useCallback((page) => {
    setCurrentPage(page)
    // Rough scroll to the right page (each page ~viewport height)
    if (containerRef.current) {
      const approxPageHeight = containerRef.current.scrollHeight / (pdfDocument?.numPages || 1)
      containerRef.current.scrollTo({ top: page * approxPageHeight, behavior: 'smooth' })
    }
  }, [setCurrentPage, pdfDocument])

  // Swipe gestures — only active in scroll mode (book view has its own)
  const isScrollMode = preferences.readingMode !== 'book'
  useSwipeGesture(isScrollMode ? containerRef : { current: null }, {
    onSwipeLeft:  goToNextPage,
    onSwipeRight: goToPrevPage,
  })

  // Keyboard shortcuts
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

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface-0)] gap-4">
        <Spinner size={36} />
        <p className="text-sm text-[var(--text-muted)] animate-pulse">Loading document…</p>
        <p className="text-xs text-[var(--text-muted)] opacity-60">
          Large PDFs may take a moment
        </p>
      </div>
    )
  }

  /* ── Error state ── */
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface-0)] gap-4 px-6 text-center">
        <div className="text-5xl">⚠️</div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Failed to load PDF</p>
        <p className="text-sm text-red-500 max-w-xs">{loadError}</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          ← Back to Library
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
          onToggleRoomManager={() => setShowRoomManager(true)}
          inRoom={inRoom}
          sidebarOpen={showSidebar}
          roomPanelOpen={showRoomPanel}
          roomChatOpen={showRoomChat}
          bookmarksOpen={showBookmarks}
          unreadChat={unreadChat}
        />
        <SearchPanel open={showSearch} onClose={() => setShowSearch(false)} />
        <BookmarkPanel
          open={showBookmarks}
          onClose={() => setShowBookmarks(false)}
          onJumpToPage={goToPage}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        <main className="flex-1 relative overflow-hidden">
          {preferences.readingMode === 'book'
            ? <BookView onPageChange={(p) => { if (inRoom && preferences.syncLocked) sendPageChange(p) }} />
            : <PDFRenderer onScroll={handleScroll} readingContainerRef={containerRef} />
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
        onOpenRoomManager={() => setShowRoomManager(true)}
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

      {/* Ambient audio dot */}
      <AnimatePresence>
        {preferences.ambientEnabled && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="fixed bottom-14 right-3 z-20 w-3 h-3 rounded-full bg-purple-400 ambient-indicator cursor-pointer"
            title="Ambient sound — click to stop"
            onClick={toggleAmbient}
          />
        )}
      </AnimatePresence>

      {/* Swipe hint (mobile only) */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-xs px-4 py-2 rounded-full pointer-events-none"
          >
            👈 Swipe to navigate pages 👉
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room manager accessible from inside reader */}
      <RoomManager
        open={showRoomManager}
        onClose={() => setShowRoomManager(false)}
        onRoomJoined={() => { setShowRoomManager(false); setShowRoomPanel(true) }}
      />
    </div>
  )
}
