/**
 * App.jsx — root component, manages the three main views:
 *   LANDING  →  LOBBY  →  READER
 *
 * Also hosts the global "user joined" toast notification system.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion }  from 'framer-motion'
import { UserPlus }        from 'lucide-react'
import { AppLayout }       from './components/Layout/AppLayout'
import { LandingView }     from './views/LandingView'
import { LobbyView }       from './views/LobbyView'
import { ReaderView }      from './views/ReaderView'
import { useUserStore }    from './store/userStore'
import { useRoomStore }    from './store/roomStore'
import { useReaderStore }  from './store/readerStore'
import { useSync }         from './hooks/useSync'
import { socketService }   from './services/socketService'
import { retrievePDF, getCachedPDFBuffer } from './services/storageService'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const VIEWS = { LANDING: 'landing', LOBBY: 'lobby', READER: 'reader' }

/* ── Join toast component ────────────────────────────────────────── */
const JoinToasts = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div key={t.id}
          initial={{ opacity:0, x:80, scale:0.9 }}
          animate={{ opacity:1, x:0,  scale:1   }}
          exit={{ opacity:0, x:80, scale:0.9   }}
          transition={{ type:'spring', stiffness:340, damping:26 }}
          className="flex items-center gap-2.5 bg-[var(--surface-0)] border border-[var(--border)] shadow-xl rounded-2xl px-4 py-2.5 min-w-[200px] max-w-[260px]">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: t.avatarColor }}>
            {t.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.username}</p>
            <p className="text-[10px] text-[var(--text-muted)]">joined the room</p>
          </div>
          <UserPlus size={12} className="text-emerald-500 flex-shrink-0" />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
)

/* ════════════════════════════════════════════════════════════════════
   APP
════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [view,            setView]            = useState(VIEWS.LANDING)
  const [activePDFBuffer, setActivePDFBuffer] = useState(null)
  const [activeBookId,    setActiveBookId]    = useState(null)
  const [reconnecting,    setReconnecting]    = useState(false)
  const [toasts,          setToasts]          = useState([])

  const prevParticipantsRef = useRef([])

  const { user, preferences, initUser } = useUserStore()
  const {
    currentRoom, savedRoomId, setRoom, setParticipants, setReading,
    leaveRoom, clearSavedRoom,
  } = useRoomStore()
  const { openBook } = useReaderStore()

  const handleRoomDeleted = useCallback(() => {
    setActivePDFBuffer(null)
    setActiveBookId(null)
    setView(VIEWS.LANDING)
  }, [])

  const { sendScroll, sendPageChange, sendCursor, sendHighlight, sendChatMessage, setChatPanelOpen } = useSync(handleRoomDeleted)

  /* ── Bootstrap ──────────────────────────────────────────────── */
  useEffect(() => {
    initUser()
    if (preferences?.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme)
    }
  }, [])

  /* ── Join toast helpers ─────────────────────────────────────── */
  const addToast = useCallback((participant) => {
    const id = Date.now() + Math.random()
    const initials = participant.username
      ? participant.username.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
      : '?'
    setToasts(t => [...t, { id, username: participant.username, avatarColor: participant.avatarColor, initials }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  /* ── Track new participants → fire toast ────────────────────── */
  useEffect(() => {
    const unsub = socketService.on('room:participants', (participants) => {
      if (!user) return
      const prev = prevParticipantsRef.current
      participants.forEach(p => {
        // Don't toast for self, and only toast for genuinely new participants
        if (p.clientId !== user.clientId && !prev.find(pp => pp.clientId === p.clientId) && p.isOnline) {
          addToast(p)
        }
      })
      prevParticipantsRef.current = participants
    })
    return unsub
  }, [user?.clientId, addToast])

  /* ── Attempt rejoin on page refresh ────────────────────────── */
  useEffect(() => {
    if (!savedRoomId || !user) return
    attemptRejoin(savedRoomId)
  }, [user?.clientId])

  const attemptRejoin = useCallback(async (roomId) => {
    setReconnecting(true)
    try {
      const res  = await fetch(`${BACKEND_URL}/rooms/${roomId}`)
      const data = await res.json()
      if (!res.ok) { clearSavedRoom(); setReconnecting(false); return }

      const joined = await socketService.joinRoom(roomId, user)
      setRoom(joined.room)
      prevParticipantsRef.current = joined.room.participants || []

      if (joined.room.status === 'reading') {
        const book = joined.room.book
        if (book?.bookId) {
          // Try memory cache first, then IndexedDB
          const buffer = getCachedPDFBuffer(book.bookId)
                      || await retrievePDF(book.bookId).catch(() => null)
          if (buffer) {
            setActiveBookId(book.bookId)
            setActivePDFBuffer(buffer)
            openBook(book.bookId)
            setView(VIEWS.READER)
            setReconnecting(false)
            return
          }
        }
        // PDF not found locally → go to lobby for re-upload (late joiner flow)
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
    prevParticipantsRef.current = room.participants || []
    setView(VIEWS.LOBBY)
  }, [setRoom])

  /* ── Called by LobbyView when reading starts ─────────────────── */
  const handleReadingStart = useCallback(async (data) => {
    const book = data.book || currentRoom?.book
    if (!book?.bookId) {
      console.warn('[handleReadingStart] No book info in event data')
      return
    }

    // Try memory cache first (fastest, always fresh this session)
    let buffer = getCachedPDFBuffer(book.bookId)

    // Fall back to IndexedDB if memory cache is empty (e.g. after page refresh)
    if (!buffer) {
      buffer = await retrievePDF(book.bookId).catch(() => null)
    }

    if (!buffer) {
      console.warn('[handleReadingStart] PDF buffer not found — reader cannot open.')
      // Keep showing the lobby so the user can re-upload or retry
      return
    }

    openBook(book.bookId)
    setActiveBookId(book.bookId)
    setActivePDFBuffer(buffer)
    setReading(data)
    setView(VIEWS.READER)
  }, [currentRoom, openBook, setReading])

  /* ── Leave / back ────────────────────────────────────────────── */
  const handleLeaveRoom = useCallback(() => {
    socketService.leaveRoom()
    socketService.disconnect()
    leaveRoom()
    setView(VIEWS.LANDING)
    setActivePDFBuffer(null)
    setActiveBookId(null)
    prevParticipantsRef.current = []
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
      {/* Global join toasts — visible on all screens */}
      <JoinToasts toasts={toasts} />

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
