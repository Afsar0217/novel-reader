/**
 * LandingView — the very first screen.
 * Users MUST create or join a room before reading.
 * No direct PDF upload here.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, LogIn, BookOpen, Heart, Wifi, ArrowRight, Loader2 } from 'lucide-react'
import { useUserStore } from '../store/userStore'
import { useRoomStore }  from '../store/roomStore'
import { socketService } from '../services/socketService'
import { generateRoomId } from '../utils/idGenerator'
import { getUserInitials } from '../utils/colorUtils'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const THEMES = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'sepia', label: 'Sepia', icon: '🌿' },
  { id: 'dark',  label: 'Dark',  icon: '🌙' },
]

/* ── Floating book illustration ─────────────────────────────────── */
const FloatingBooks = () => (
  <div className="relative w-52 h-52 mx-auto select-none pointer-events-none">
    <motion.div
      animate={{ y: [-5, 5, -5], rotate: [-3, -1, -3] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute left-2 top-10 w-28 h-36 rounded-2xl shadow-xl"
      style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}
    >
      <div className="absolute inset-3 rounded-xl bg-white/10 p-2 flex flex-col gap-1.5">
        {[100,80,90,70].map((w,i) => (
          <div key={i} className="h-1.5 rounded-full bg-white/30" style={{ width:`${w}%` }} />
        ))}
        <Heart size={14} className="text-white/50 self-end mt-auto" />
      </div>
    </motion.div>
    <motion.div
      animate={{ y: [5, -5, 5], rotate: [3, 5, 3] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      className="absolute right-0 top-2 w-24 h-32 rounded-2xl shadow-2xl"
      style={{ background: 'linear-gradient(135deg,#f9a8d4,#ec4899)' }}
    >
      <div className="absolute inset-2 rounded-xl bg-white/10 p-2 flex flex-col gap-1.5">
        {[80,100,60].map((w,i) => (
          <div key={i} className="h-1.5 rounded-full bg-white/30" style={{ width:`${w}%` }} />
        ))}
      </div>
    </motion.div>
    <motion.div
      animate={{ scale:[1,1.4,1], opacity:[0.7,0.2,0.7] }}
      transition={{ duration:2, repeat:Infinity }}
      className="absolute bottom-10 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400"
    />
  </div>
)

/* ════════════════════════════════════════════════════════════════════
   LANDING VIEW
════════════════════════════════════════════════════════════════════ */
export const LandingView = ({ onRoomReady }) => {
  const { user, preferences, setTheme, updateUsername } = useUserStore()
  const { setRoom } = useRoomStore()

  const [mode,       setMode]       = useState('home')  // 'home' | 'create' | 'join'
  const [joinCode,   setJoinCode]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [editName,   setEditName]   = useState(false)
  const [nameInput,  setNameInput]  = useState(user?.username || '')

  const resetToHome = () => { setMode('home'); setError(''); setJoinCode('') }

  /* ── Create room ─────────────────────────────────────────────── */
  const handleCreate = useCallback(async () => {
    if (!user) return
    setLoading(true); setError('')
    const roomId = generateRoomId()
    try {
      const res = await fetch(`${BACKEND_URL}/rooms`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          clientId:    user.clientId,
          username:    user.username,
          avatarColor: user.avatarColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create room')

      // Connect socket and join
      socketService.connect()
      const joined = await socketService.joinRoom(roomId, user)
      setRoom(joined.room)
      onRoomReady(joined.room)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, setRoom, onRoomReady])

  /* ── Join room ───────────────────────────────────────────────── */
  const handleJoin = useCallback(async () => {
    if (!user) return
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    if (code.length < 4) { setError('Enter a valid room code'); return }
    setLoading(true); setError('')
    try {
      // Check room exists
      const res = await fetch(`${BACKEND_URL}/rooms/${code}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Room not found')

      socketService.connect()
      const joined = await socketService.joinRoom(code, user)
      setRoom(joined.room)
      onRoomReady(joined.room)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, joinCode, setRoom, onRoomReady])

  const saveName = () => {
    if (nameInput.trim()) updateUsername(nameInput.trim())
    setEditName(false)
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] flex flex-col overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 border-b border-[var(--border)] sticky top-0 bg-[var(--surface-0)]/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-[var(--text-primary)] tracking-tight">SyncRead</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme switcher */}
          <div className="flex bg-[var(--surface-2)] rounded-lg p-0.5">
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                className={`px-2 py-1 rounded-md text-xs transition-all ${preferences.theme === t.id
                  ? 'bg-[var(--surface-0)] shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                {t.icon}
              </button>
            ))}
          </div>

          {/* Username */}
          {user && !editName && (
            <button onClick={() => { setNameInput(user.username); setEditName(true) }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: user.avatarColor }}>
                {getUserInitials(user.username)}
              </div>
              <span className="text-xs text-[var(--text-secondary)] hidden sm:block max-w-[90px] truncate">
                {user.username}
              </span>
            </button>
          )}
          {editName && (
            <form onSubmit={e => { e.preventDefault(); saveName() }} className="flex items-center gap-1.5">
              <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                maxLength={32}
                className="text-sm px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] w-36 focus:outline-none focus:ring-2 focus:ring-accent/50" />
              <button type="submit" className="text-xs bg-accent text-white px-2.5 py-1.5 rounded-xl">Save</button>
              <button type="button" onClick={() => setEditName(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-1.5 py-1.5">✕</button>
            </form>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center text-center px-6 pt-16 pb-20 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle,var(--accent) 0%,transparent 70%)' }} />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle,#ec4899 0%,transparent 70%)' }} />

        <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.6 }} className="relative z-10 max-w-2xl mx-auto">

          <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
            transition={{ delay:0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/8 text-accent text-xs font-semibold mb-6">
            <Heart size={11} className="fill-accent" /> For long-distance readers
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] leading-tight tracking-tight mb-5">
            Read novels with{' '}
            <span className="text-accent">your loved ones</span>
            {' '}— together
          </h1>

          <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-10 max-w-xl mx-auto">
            Create a reading room, share the code, and experience every page together — in perfect sync.
          </p>

          {/* ── Mode selection ── */}
          <AnimatePresence mode="wait">
            {mode === 'home' && (
              <motion.div key="home" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                  onClick={() => setMode('create')}
                  className="flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-2xl font-semibold text-sm shadow-lg shadow-accent/25 hover:bg-accent/90 transition-colors w-full sm:w-auto justify-center">
                  <Plus size={18} /> Create a Room
                </motion.button>
                <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                  onClick={() => setMode('join')}
                  className="flex items-center gap-2 px-7 py-3.5 bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] rounded-2xl font-semibold text-sm hover:bg-[var(--surface-2)] hover:border-accent/30 transition-all w-full sm:w-auto justify-center">
                  <LogIn size={18} /> Join with Code
                </motion.button>
              </motion.div>
            )}

            {mode === 'create' && (
              <motion.div key="create" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto">
                <div className="w-full bg-[var(--surface-1)] rounded-2xl p-5 border border-[var(--border)] text-left space-y-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">You'll be the owner</p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    A unique room code will be generated. Share it with your partner so they can join.
                  </p>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={handleCreate} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-2xl font-semibold text-sm shadow hover:bg-accent/90 disabled:opacity-60 transition-all">
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                    : <><Plus size={16} /> Create Room <ArrowRight size={14} /></>
                  }
                </button>
                <button onClick={resetToHome} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  ← Back
                </button>
              </motion.div>
            )}

            {mode === 'join' && (
              <motion.div key="join" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
                <p className="text-sm text-[var(--text-secondary)]">Enter the room code from your partner:</p>
                <input
                  type="text"
                  placeholder="XXXX-XXXX"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  maxLength={9}
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/50 uppercase"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={handleJoin} disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-2xl font-semibold text-sm shadow hover:bg-accent/90 disabled:opacity-60 transition-all">
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Joining…</>
                    : <><LogIn size={16} /> Join Room <ArrowRight size={14} /></>
                  }
                </button>
                <button onClick={resetToHome} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  ← Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.3 }} className="relative z-10 mt-12">
          <FloatingBooks />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-14 max-w-3xl mx-auto w-full">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Three steps to read together</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { n:'01', icon:<Users  size={22} className="text-accent"/>, title:'Create a room', desc:'One person creates a room and gets a unique code. Share it with your partner.' },
            { n:'02', icon:<BookOpen size={22} className="text-accent"/>, title:'Both upload PDF', desc:'Owner selects the PDF. You each upload your own copy — the file never leaves your device.' },
            { n:'03', icon:<Wifi   size={22} className="text-accent"/>, title:'Read in sync', desc:'Pages turn together. Highlights appear live. Chat as you read.' },
          ].map((s,i) => (
            <motion.div key={s.n}
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true }} transition={{ delay:i*0.1 }}
              className="relative flex flex-col gap-4 p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] hover:border-accent/25 hover:bg-[var(--surface-2)] transition-all">
              <span className="absolute top-4 right-4 text-3xl font-black text-[var(--surface-3)] select-none">{s.n}</span>
              <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">{s.icon}</div>
              <div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">{s.title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="py-6 text-center border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          SyncRead · Your books stay on your device · Made with <Heart size={10} className="text-red-400 fill-red-400 inline" /> for readers
        </p>
      </footer>
    </div>
  )
}
