/**
 * App.jsx — root component, manages the three main views:
 *
 *   LANDING  →  LOBBY  →  READER
 *
 * Persistence: if the user was in a room before refreshing, we attempt
 * to reconnect to that room (savedRoomId from localStorage).
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion }  from 'framer-motion'
import { AppLayout }    from './components/Layout/AppLayout'
import { LandingView }  from './views/LandingView'
import { LobbyView }    from './views/LobbyView'
import { ReaderView }   from './views/ReaderView'
import { useUserStore } from './store/userStore'
import { useRoomStore } from './store/roomStore'
import { useReaderStore } from './store/readerStore'
import { useSync }      from './hooks/useSync'
import { socketService } from './services/socketService'
import { retrievePDF }   from './services/storageService'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const VIEWS = { LANDING: 'landing', LOBBY: 'lobby', READER: 'reader' }

export default function App() {
  const [view,          setView]          = useState(VIEWS.LANDING)
  const [activePDFBuffer, setActivePDFBuffer] = useState(null)
  const [activeBookId,  setActiveBookId]  = useState(null)
  const [reconnecting,  setReconnecting]  = useState(false)

  const { user, preferences, initUser } = useUserStore()
  const {
    currentRoom, savedRoomId, setRoom, setParticipants, setReading,
    leaveRoom, clearSavedRoom, patchRoom,
  } = useRoomStore()
  const { openBook } = useReaderStore()

  /* ── Sync hook — always active while in a room ──────────────── */
  const { sendScroll, sendPageChange, sendCursor, sendHighlight, sendChatMessage, setChatPanelOpen } = useSync()

  /* ── Bootstrap ──────────────────────────────────────────────── */
  useEffect(() => {
    initUser()
    if (preferences?.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme)
    }
  }, [])

  /* ── Attempt rejoin on page refresh ────────────────────────── */
  useEffect(() => {
    if (!savedRoomId || !user) return
    attemptRejoin(savedRoomId)
  }, [user?.clientId])  // run once user is loaded

  const attemptRejoin = useCallback(async (roomId) => {
    setReconnecting(true)
    try {
      const res  = await fetch(`${BACKEND_URL}/rooms/${roomId}`)
      const data = await res.json()
      if (!res.ok) { clearSavedRoom(); setReconnecting(false); return }

      socketService.connect()
      const joined = await socketService.joinRoom(roomId, user)
      setRoom(joined.room)

      // Decide where to navigate
      if (joined.room.status === 'reading') {
        // Try to load their local copy of the PDF
        const book = joined.room.book
        if (book?.bookId) {
          const buffer = await retrievePDF(book.bookId).catch(() => null)
          if (buffer) {
            setActiveBookId(book.bookId)
            setActivePDFBuffer(buffer)
            openBook(book.bookId)
            setView(VIEWS.READER)
            setReconnecting(false)
            return
          }
        }
        // Buffer not found locally → go to lobby so they can re-upload
        setView(VIEWS.LOBBY)
      } else {
        setView(VIEWS.LOBBY)
      }
    } catch {
      clearSavedRoom()
    } finally {
      setReconnecting(false)
    }
  }, [user, clearSavedRoom, setRoom, openBook])

  /* ── Called by LandingView after create/join ─────────────────── */
  const handleRoomReady = useCallback((room) => {
    setRoom(room)
    setView(VIEWS.LOBBY)
  }, [setRoom])

  /* ── Called by LobbyView when book:start fires ───────────────── */
  const handleReadingStart = useCallback(async (data) => {
    const book = data.book || currentRoom?.book
    if (!book) return

    // Owner already has the buffer in state; viewers stored it during confirm
    const buffer = await retrievePDF(book.bookId).catch(() => null)
    if (!buffer) {
      console.warn('PDF not found in local storage')
      return
    }
    openBook(book.bookId)
    setActiveBookId(book.bookId)
    setActivePDFBuffer(buffer)
    setReading(data)
    setView(VIEWS.READER)
  }, [currentRoom, openBook, setReading])

  /* ── Leave / back from reader ────────────────────────────────── */
  const handleLeaveRoom = useCallback(() => {
    socketService.leaveRoom()
    socketService.disconnect()
    leaveRoom()
    setView(VIEWS.LANDING)
    setActivePDFBuffer(null)
    setActiveBookId(null)
  }, [leaveRoom])

  const handleBackToLobby = useCallback(() => {
    setView(VIEWS.LOBBY)
    setActivePDFBuffer(null)
    setActiveBookId(null)
  }, [])

  /* ── Reconnecting spinner ────────────────────────────────────── */
  if (reconnecting) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Rejoining your room…</p>
      </div>
    )
  }

  return (
    <AppLayout>
      <AnimatePresence mode="wait">

        {view === VIEWS.LANDING && (
          <motion.div key="landing"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.2 }}>
            <LandingView onRoomReady={handleRoomReady} />
          </motion.div>
        )}

        {view === VIEWS.LOBBY && (
          <motion.div key="lobby"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.2 }}>
            <LobbyView
              onReadingStart={handleReadingStart}
              onLeave={handleLeaveRoom}
            />
          </motion.div>
        )}

        {view === VIEWS.READER && activeBookId && activePDFBuffer && (
          <motion.div key="reader"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.2 }}
            className="h-screen">
            <ReaderView
              bookId={activeBookId}
              pdfBuffer={activePDFBuffer}
              onBack={handleBackToLobby}
              sendScroll={sendScroll}
              sendPageChange={sendPageChange}
              sendCursor={sendCursor}
              sendHighlight={sendHighlight}
              sendChatMessage={sendChatMessage}
              setChatPanelOpen={setChatPanelOpen}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </AppLayout>
  )
}
