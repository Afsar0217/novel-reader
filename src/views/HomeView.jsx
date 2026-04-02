import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Users, BookOpen, Trash2,
  Copy, Check, LogOut, ChevronRight,
  ArrowRight, Heart, Wifi, Bookmark,
} from 'lucide-react'
import { useReaderStore } from '../store/readerStore'
import { useUserStore } from '../store/userStore'
import { useRoomStore } from '../store/roomStore'
import { storePDF, retrievePDF } from '../services/storageService'
import { generateBookId } from '../utils/idGenerator'
import { Button } from '../components/UI/Button'
import { Modal } from '../components/UI/Modal'
import { RoomManager } from '../features/rooms/RoomManager'
import { getUserInitials } from '../utils/colorUtils'

const THEMES = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'sepia', label: 'Sepia', icon: '🌿' },
  { id: 'dark',  label: 'Dark',  icon: '🌙' },
]
const fmt = (b) => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`
const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })

/* ── Animated floating book illustration ── */
const FloatingBooks = () => (
  <div className="relative w-48 h-48 mx-auto select-none pointer-events-none">
    {/* Back book */}
    <motion.div
      animate={{ y: [-4, 4, -4], rotate: [-3, -1, -3] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute left-4 top-8 w-28 h-36 rounded-xl shadow-xl"
      style={{ background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' }}
    >
      <div className="absolute left-3 top-3 right-3 bottom-3 rounded-lg bg-white/10 flex flex-col justify-between p-2">
        <div className="space-y-1.5">
          {[100,80,90,70].map((w,i) => (
            <div key={i} className="h-1.5 rounded-full bg-white/30" style={{ width:`${w}%` }} />
          ))}
        </div>
        <Heart size={16} className="text-white/60 self-end" />
      </div>
    </motion.div>
    {/* Front book */}
    <motion.div
      animate={{ y: [4, -4, 4], rotate: [3, 5, 3] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      className="absolute right-2 top-2 w-24 h-32 rounded-xl shadow-2xl"
      style={{ background: 'linear-gradient(135deg, #f9a8d4 0%, #ec4899 100%)' }}
    >
      <div className="absolute left-2 top-2 right-2 bottom-2 rounded-lg bg-white/10 flex flex-col justify-between p-2">
        <div className="space-y-1.5">
          {[80,100,60,90].map((w,i) => (
            <div key={i} className="h-1.5 rounded-full bg-white/30" style={{ width:`${w}%` }} />
          ))}
        </div>
        <Bookmark size={12} className="text-white/60 self-end" />
      </div>
    </motion.div>
    {/* Ping dot */}
    <motion.div
      animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0.3, 0.7] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400"
    />
  </div>
)

/* ── Room Active Banner ── */
const RoomBanner = ({ room, user, onLeaveRoom }) => {
  const [copied, setCopied] = useState(false)
  const onlineCount = room.users?.filter(u => u.isOnline).length || 1
  const copy = () => {
    navigator.clipboard.writeText(room.roomId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <motion.div
      initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
      className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="sync-live-dot flex-shrink-0" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Room Active</span>
        <span className="font-mono font-bold text-sm tracking-widest text-accent">{room.roomId}</span>
        <button onClick={copy} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] flex-shrink-0">
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
        <span className="text-xs text-[var(--text-muted)]">· {onlineCount} online</span>
      </div>
      <button
        onClick={onLeaveRoom}
        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-500/8 transition-colors self-start sm:self-auto border border-red-500/20"
      >
        <LogOut size={12} /> Leave Room
      </button>
    </motion.div>
  )
}

/* ════════════════════════════════════════════
   HOME VIEW
════════════════════════════════════════════ */
export const HomeView = ({ onOpenBook, onJoinRoom, onLeaveRoom }) => {
  const { books, addBook, removeBook, openBook, getReadingProgress } = useReaderStore()
  const { user, preferences, setTheme, updateUsername } = useUserStore()
  const { currentRoom } = useRoomStore()

  const [isDragging,      setIsDragging]      = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [loadError,       setLoadError]       = useState('')
  const [showRoomManager, setShowRoomManager] = useState(false)
  const [editingName,     setEditingName]     = useState(false)
  const [nameInput,       setNameInput]       = useState(user?.username || '')
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setLoadError('Please upload a PDF file (.pdf)'); return
    }
    if (file.size > 200 * 1024 * 1024) {
      setLoadError('File too large (max 200 MB)'); return
    }
    setLoading(true); setLoadError('')
    try {
      const bookId = generateBookId(file.name, file.size)
      const arrayBuffer = await file.arrayBuffer()
      await storePDF(bookId, arrayBuffer.slice(0))
      const book = { id: bookId, title: file.name.replace(/\.pdf$/i,''), filename: file.name, size: file.size, addedAt: Date.now() }
      addBook(book); openBook(bookId)
      onOpenBook(bookId, arrayBuffer, !!currentRoom)
    } catch(e) { setLoadError(e.message || 'Failed to load PDF') }
    finally    { setLoading(false) }
  }, [addBook, openBook, onOpenBook, currentRoom])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''
  }

  const handleOpenExistingBook = async (bookId) => {
    openBook(bookId)
    try {
      const buffer = await retrievePDF(bookId)
      if (buffer) onOpenBook(bookId, buffer, !!currentRoom)
      else setLoadError('PDF not found — please re-upload.')
    } catch { setLoadError('Failed to load PDF from storage.') }
  }

  const handleSaveName = () => { if (nameInput.trim()) updateUsername(nameInput.trim()); setEditingName(false) }

  const bookList = Object.values(books).sort((a,b) => b.addedAt - a.addedAt)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-0)] overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-[var(--border)] sticky top-0 bg-[var(--surface-0)]/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-[var(--text-primary)] tracking-tight">SyncRead</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme */}
          <div className="flex bg-[var(--surface-2)] rounded-lg p-0.5">
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                className={`px-2 py-1 rounded-md text-xs transition-all ${preferences.theme===t.id ? 'bg-[var(--surface-0)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                {t.icon}
              </button>
            ))}
          </div>

          {currentRoom ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-600">
              <div className="sync-live-dot" style={{ background:'#10b981' }} />
              {currentRoom.roomId}
            </div>
          ) : (
            <button onClick={() => setShowRoomManager(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:border-accent/30 transition-all">
              <Users size={13} /> Join Room
            </button>
          )}

          {user && (
            <button onClick={() => { setNameInput(user.username); setEditingName(true) }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: user.avatarColor }}>
                {getUserInitials(user.username)}
              </div>
              <span className="text-xs text-[var(--text-secondary)] hidden sm:block max-w-[90px] truncate">{user.username}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-16 pb-20 overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }} />

        <motion.div
          initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.6, ease:'easeOut' }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          {/* Pill badge */}
          <motion.div
            initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
            transition={{ delay:0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/8 text-accent text-xs font-semibold mb-6"
          >
            <Heart size={11} className="fill-accent" />
            For long-distance readers
          </motion.div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-tight tracking-tight mb-5">
            Read novels with{' '}
            <span className="relative">
              <span className="text-accent">your loved ones</span>
              <motion.svg
                initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
                transition={{ delay:0.7, duration:0.8, ease:'easeOut' }}
                className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none"
              >
                <motion.path d="M2 8 Q50 2 100 8 Q150 14 198 8" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" className="text-accent/50"
                  initial={{ pathLength:0 }} animate={{ pathLength:1 }} transition={{ delay:0.7, duration:0.8 }}
                />
              </motion.svg>
            </span>
            {' '}— together
          </h1>

          {/* Sub */}
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-8 max-w-xl mx-auto">
            Share a room code with someone far away and read the same page, at the same time.
            Every highlight, every scroll — perfectly in sync.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-2xl font-semibold text-sm shadow-lg shadow-accent/25 hover:bg-accent/90 transition-colors w-full sm:w-auto justify-center"
            >
              <Upload size={16} /> Upload a PDF
            </motion.button>
            <motion.button
              whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
              onClick={() => setShowRoomManager(true)}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl font-semibold text-sm hover:bg-[var(--surface-2)] hover:border-accent/30 transition-all w-full sm:w-auto justify-center"
            >
              <Users size={16} />
              {currentRoom ? `Room: ${currentRoom.roomId}` : 'Create or Join Room'}
            </motion.button>
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
        </motion.div>

        {/* Illustration */}
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.3, duration:0.6 }}
          className="relative z-10 mt-12"
        >
          <FloatingBooks />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-14 max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }}
          viewport={{ once:true }} transition={{ duration:0.5 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Three steps to read together
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step:'01', icon:<Upload size={22} className="text-accent"/>, title:'Upload your book', desc:'Drop any PDF — novels, comics, manga, textbooks. Stored locally, never uploaded anywhere.' },
            { step:'02', icon:<Users  size={22} className="text-accent"/>, title:'Share a room code', desc:'Create a room and send the 8-letter code to your partner. They join instantly, no sign-up.' },
            { step:'03', icon:<Wifi   size={22} className="text-accent"/>, title:'Read in sync', desc:'Scroll together, highlight together, chat in the room. Miles apart, same page.' },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ delay: i*0.1, duration:0.5 }}
              className="relative flex flex-col gap-4 p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] hover:border-accent/25 hover:bg-[var(--surface-2)] transition-all group"
            >
              <span className="absolute top-4 right-4 text-3xl font-black text-[var(--surface-3)] select-none">{s.step}</span>
              <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">
                {s.icon}
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">{s.title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Main content (upload + library) ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pb-16 space-y-8">

        {/* Room banner */}
        <AnimatePresence>
          {currentRoom && (
            <RoomBanner room={currentRoom} user={user} onLeaveRoom={onLeaveRoom} />
          )}
        </AnimatePresence>

        {/* Upload drop-zone */}
        <motion.div
          initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.05 }}
        >
          <div
            className={`relative border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-accent bg-accent/5 scale-[1.01]'
                : 'border-[var(--border)] hover:border-accent/50 hover:bg-[var(--surface-1)]'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                isDragging ? 'bg-accent scale-110' : 'bg-[var(--surface-2)] group-hover:bg-accent/10'
              }`}>
                {loading
                  ? <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  : <Upload size={26} className={isDragging ? 'text-white' : 'text-[var(--text-muted)]'} />
                }
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  {loading ? 'Loading…' : isDragging ? 'Drop it!' : 'Drop a PDF here'}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">or click to browse · max 200 MB</p>
              </div>
            </div>
          </div>

          {loadError && (
            <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }}
              className="text-sm text-red-500 text-center mt-3">
              {loadError}
            </motion.p>
          )}
        </motion.div>

        {/* Library */}
        {bookList.length > 0 && (
          <motion.section initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Your Library ({bookList.length})
              </h2>
              {currentRoom && (
                <span className="text-xs text-accent font-medium flex items-center gap-1">
                  <div className="sync-live-dot" style={{ width:6, height:6, background:'#10b981' }} />
                  Click to open in room
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bookList.map((book, i) => {
                const progress = getReadingProgress(book.id)
                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative bg-[var(--surface-1)] rounded-2xl p-4 hover:bg-[var(--surface-2)] transition-all cursor-pointer border border-transparent hover:border-[var(--border)]"
                    onClick={() => handleOpenExistingBook(book.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-12 bg-gradient-to-br from-accent/80 to-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                        <BookOpen size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{book.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{fmt(book.size)} · {fmtDate(book.addedAt)}</p>
                        {progress?.page > 0 && (
                          <p className="text-xs text-accent mt-0.5">Resume p.{progress.page+1}</p>
                        )}
                      </div>
                      <ChevronRight size={15} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>

                    <button
                      className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                      onClick={(e) => { e.stopPropagation(); removeBook(book.id) }}
                      title="Remove from library"
                    >
                      <Trash2 size={12} />
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </motion.section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-6 text-center border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          SyncRead · No server · No account · Your books stay on your device
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center justify-center gap-1">
          Made with <Heart size={10} className="text-red-400 fill-red-400" /> for readers everywhere
        </p>
      </footer>

      {/* Modals */}
      <RoomManager
        open={showRoomManager}
        onClose={() => setShowRoomManager(false)}
        onRoomJoined={() => { onJoinRoom?.(); setShowRoomManager(false) }}
      />

      <Modal open={editingName} onClose={() => setEditingName(false)} title="Your Display Name" size="sm">
        <div className="space-y-4">
          <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleSaveName()} maxLength={32} autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditingName(false)} className="flex-1">Cancel</Button>
            <Button variant="primary"   onClick={handleSaveName}              className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
