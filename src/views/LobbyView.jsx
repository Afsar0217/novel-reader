/**
 * LobbyView — Waiting room + late-joiner flow.
 *
 * Cases handled:
 *   A) Owner: waiting → selects PDF → everyone confirms → reading starts
 *   B) Viewer (on-time): waits for owner → uploads same PDF → confirms → reading starts
 *   C) Late joiner: room already reading → uploads same PDF → goes to reader directly
 *   D) Reconnect: PDF in IndexedDB → App.jsx sends them straight to READER
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Users, Crown, BookOpen, Upload,
  Loader2, LogOut, Play, Eye, CheckCircle2, Clock, UserPlus,
} from 'lucide-react'
import { useRoomStore }   from '../store/roomStore'
import { useUserStore }   from '../store/userStore'
import { useReaderStore } from '../store/readerStore'
import { socketService }  from '../services/socketService'
import { storePDF, cachePDFBuffer } from '../services/storageService'
import { generateBookId } from '../utils/idGenerator'
import { getUserInitials } from '../utils/colorUtils'

/* ── Participant card ────────────────────────────────────────────── */
const ParticipantCard = ({ participant, isMe, isOwner, isController }) => (
  <motion.div layout initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
    className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)]">
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: participant.avatarColor }}>
        {getUserInitials(participant.username)}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-1)]
        ${participant.isOnline ? 'bg-emerald-400' : 'bg-gray-400'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[130px]">
          {participant.username}
        </span>
        {isMe && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">You</span>
        )}
        {isOwner && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 font-semibold flex items-center gap-0.5">
            <Crown size={9} /> Owner
          </span>
        )}
        {isController && !isOwner && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 font-semibold flex items-center gap-0.5">
            <BookOpen size={9} /> Reader
          </span>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        {participant.isOnline ? 'Online' : 'Disconnected'}
      </p>
    </div>
  </motion.div>
)

/* ════════════════════════════════════════════════════════════════════
   LOBBY VIEW
════════════════════════════════════════════════════════════════════ */
export const LobbyView = ({ onReadingStart, onLeave }) => {
  const { currentRoom, setBook, setConfirmStatus, setReading, setParticipants } = useRoomStore()
  const { user }    = useUserStore()
  const { addBook } = useReaderStore()

  const [copied,       setCopied]       = useState(false)
  const [uploadState,  setUploadState]  = useState('idle')   // idle|uploading|waiting|confirmed
  const [confirmStats, setConfirmStats] = useState(null)
  const [bookInfo,     setBookInfo]     = useState(null)
  const [error,        setError]        = useState('')
  /** true when the user joins a room that's already reading */
  const [lateJoiner,   setLateJoiner]   = useState(false)

  const fileInputRef  = useRef(null)
  const isOwner       = currentRoom?.ownerId === user?.clientId
  const isController  = currentRoom?.activeControllerId === user?.clientId
  const amIController = isOwner || isController

  /* ── Socket listeners ────────────────────────────────────────── */
  useEffect(() => {
    if (!currentRoom) return

    const unsubs = [
      socketService.on('book:requested', ({ book }) => {
        setBookInfo(book)
        setBook(book)

        if (currentRoom.status === 'reading') {
          // Late joiner: room already in progress, they need to upload
          setLateJoiner(true)
          setUploadState('idle')
        } else if (currentRoom.activeControllerId !== user?.clientId) {
          setUploadState('idle')
        }
      }),

      socketService.on('book:confirm_status', (stats) => {
        setConfirmStats(stats)
        setConfirmStatus(stats)
      }),

      socketService.on('book:start', (data) => {
        setReading(data)
        onReadingStart(data)
      }),

      socketService.on('room:participants', (participants) => {
        setParticipants(participants)
      }),

      socketService.on('room:deleted', () => { onLeave() }),
    ]

    // ── Initial state sync (room had book before we mounted) ──
    if (currentRoom.book) {
      setBookInfo(currentRoom.book)

      if (currentRoom.status === 'confirming') {
        // Was in confirming when we joined/reconnected
        setUploadState(amIController ? 'confirmed' : 'idle')

      } else if (currentRoom.status === 'reading' && !amIController) {
        // Joined a room that's already reading → late joiner
        setLateJoiner(true)
        setUploadState('idle')
      }
    }

    return () => unsubs.forEach(u => u())
  }, [currentRoom?.roomId, user?.clientId])

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleCopy = () => {
    navigator.clipboard.writeText(currentRoom.roomId).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    })
  }

  /** Owner: pick PDF → send book:set to server */
  const handleOwnerFileSelect = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) { setError('Please select a PDF file'); return }
    setUploadState('uploading'); setError('')
    try {
      const buffer = await file.arrayBuffer()
      const bookId = generateBookId(file.name, file.size)
      const bookData = {
        id: bookId, title: file.name.replace(/\.pdf$/i, ''),
        filename: file.name, size: file.size, addedAt: Date.now(),
      }
      // Cache in memory first (instant) — IndexedDB is a reliable backup
      cachePDFBuffer(bookId, buffer.slice(0))
      await storePDF(bookId, buffer)
      addBook({ ...bookData, arrayBuffer: buffer })
      socketService.setBook({ bookId, title: bookData.title, filename: file.name, size: file.size })
      setBookInfo({ bookId, title: bookData.title, filename: file.name, size: file.size })
      setUploadState('waiting')
    } catch (e) {
      setError(e.message || 'Failed to process PDF'); setUploadState('idle')
    }
  }, [addBook])

  /** Viewer (on-time): upload + confirm via server */
  const handleViewerFileSelect = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) { setError('Please select a PDF file'); return }
    if (!bookInfo) return
    setUploadState('uploading'); setError('')
    try {
      const buffer = await file.arrayBuffer()
      const bookId = generateBookId(file.name, file.size)
      if (bookId !== bookInfo.bookId) {
        setError(`Doesn't match. Please upload "${bookInfo.filename}"`)
        setUploadState('idle'); return
      }
      const bookData = {
        id: bookId, title: file.name.replace(/\.pdf$/i, ''),
        filename: file.name, size: file.size, addedAt: Date.now(),
      }
      // Cache in memory first (instant) — IndexedDB is a reliable backup
      cachePDFBuffer(bookId, buffer.slice(0))
      await storePDF(bookId, buffer)
      addBook({ ...bookData, arrayBuffer: buffer })
      socketService.confirmBook()
      setUploadState('confirmed')
    } catch (e) {
      setError(e.message || 'Upload failed'); setUploadState('idle')
    }
  }, [bookInfo, addBook])

  /** Late joiner: upload → go straight to reader (no server coordination) */
  const handleLateJoinerFileSelect = useCallback(async (file) => {
    if (!file || !file.type.includes('pdf')) { setError('Please select a PDF file'); return }
    if (!bookInfo) return
    setUploadState('uploading'); setError('')
    try {
      const buffer = await file.arrayBuffer()
      const bookId = generateBookId(file.name, file.size)
      if (bookId !== bookInfo.bookId) {
        setError(`Doesn't match. Please upload "${bookInfo.filename}" (${(bookInfo.size / 1024 / 1024).toFixed(1)} MB)`)
        setUploadState('idle'); return
      }
      const bookData = {
        id: bookId, title: file.name.replace(/\.pdf$/i, ''),
        filename: file.name, size: file.size, addedAt: Date.now(),
      }
      // Cache in memory first (instant) — IndexedDB is a reliable backup
      cachePDFBuffer(bookId, buffer.slice(0))
      await storePDF(bookId, buffer)
      addBook({ ...bookData, arrayBuffer: buffer })
      setUploadState('confirmed')
      // Navigate directly — room is already reading, no server ack needed
      onReadingStart({ book: bookInfo })
    } catch (e) {
      setError(e.message || 'Upload failed'); setUploadState('idle')
    }
  }, [bookInfo, addBook, onReadingStart])

  const handleForceStart = () => { socketService.forceStart() }

  const handleLeave = () => { socketService.leaveRoom(); onLeave() }

  if (!currentRoom || !user) return null

  const participants = currentRoom.participants || []

  return (
    <div className="min-h-screen bg-[var(--surface-0)] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="font-bold text-[var(--text-primary)]">SyncRead</span>
          </div>
          <button onClick={handleLeave}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-500 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            <LogOut size={13} /> Leave
          </button>
        </div>

        {/* ── Room code ── */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl p-5 mb-4">
          <p className="text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-widest">Room Code</p>
          <div className="flex items-center gap-3">
            <span className="flex-1 font-mono text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-widest">
              {currentRoom.roomId}
            </span>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-sm font-semibold transition-colors">
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Share this code with your reading partner</p>
        </motion.div>

        {/* ── Participants ── */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Participants ({participants.filter(p => p.isOnline).length} online / {participants.length})
            </span>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {participants.map(p => (
                <ParticipantCard
                  key={p.clientId}
                  participant={p}
                  isMe={p.clientId === user.clientId}
                  isOwner={p.clientId === currentRoom.ownerId}
                  isController={p.clientId === currentRoom.activeControllerId}
                />
              ))}
              {participants.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">Waiting for participants…</p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Action panel ── */}
        <AnimatePresence mode="wait">

          {/* ─ Waiting: before any book selected ─ */}
          {currentRoom.status === 'waiting' && (
            <motion.div key="waiting-panel" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl p-5 space-y-4">
              {amIController ? (
                <>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">You're the owner</p>
                    <p className="text-sm text-[var(--text-muted)]">Select a PDF to start. Your partner will be asked to upload the same file.</p>
                  </div>
                  {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                  <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleOwnerFileSelect(e.target.files[0])} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadState === 'uploading'}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent/90 disabled:opacity-60 transition-all">
                    {uploadState === 'uploading'
                      ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                      : <><Upload size={16} /> Select PDF to Start</>}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-3)] flex items-center justify-center">
                    <Clock size={22} className="text-[var(--text-muted)]" />
                  </div>
                  <p className="font-semibold text-[var(--text-primary)]">Waiting for owner</p>
                  <p className="text-sm text-[var(--text-muted)] text-center">The room owner will select a PDF to begin.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─ Confirming: participants uploading ─ */}
          {currentRoom.status === 'confirming' && bookInfo && (
            <motion.div key="confirming-panel" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl p-5 space-y-4">
              {/* Book info */}
              <div className="flex gap-3 p-3 bg-[var(--surface-2)] rounded-2xl">
                <div className="w-12 h-14 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <BookOpen size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] truncate">{bookInfo.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{bookInfo.filename}</p>
                  <p className="text-xs text-[var(--text-muted)]">{(bookInfo.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>

              {/* Progress */}
              {confirmStats && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Confirmed</span>
                    <span className="font-semibold text-[var(--text-primary)]">{confirmStats.confirmed}/{confirmStats.total}</span>
                  </div>
                  <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${(confirmStats.confirmed / Math.max(confirmStats.total,1)) * 100}%` }}
                      className="h-full bg-emerald-400 rounded-full" transition={{ type:'spring', stiffness:120 }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participants.map(p => (
                      <div key={p.clientId} className="flex items-center gap-1 text-xs">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: p.avatarColor }}>
                          {getUserInitials(p.username)}
                        </div>
                        {confirmStats.details?.[p.clientId]
                          ? <CheckCircle2 size={12} className="text-emerald-500" />
                          : <Clock size={12} className="text-[var(--text-muted)]" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Viewer upload */}
              {!amIController && uploadState !== 'confirmed' && (
                <>
                  {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                  <div className="text-center space-y-0.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Upload your copy to join</p>
                    <p className="text-xs text-[var(--text-muted)]">Upload the same file: <strong>{bookInfo.filename}</strong></p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleViewerFileSelect(e.target.files[0])} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadState === 'uploading'}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent/90 disabled:opacity-60 transition-all">
                    {uploadState === 'uploading'
                      ? <><Loader2 size={16} className="animate-spin" /> Uploading…</>
                      : <><Upload size={16} /> Upload "{bookInfo.filename}"</>}
                  </button>
                </>
              )}
              {!amIController && uploadState === 'confirmed' && (
                <div className="flex items-center gap-2 justify-center py-1">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-sm text-emerald-600 font-semibold">PDF confirmed! Waiting for others…</span>
                </div>
              )}

              {/* Owner: waiting + force start */}
              {amIController && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 justify-center">
                    <Loader2 size={15} className="animate-spin text-accent" />
                    <span className="text-sm text-[var(--text-secondary)]">Waiting for all participants to upload…</span>
                  </div>
                  <button onClick={handleForceStart}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] rounded-2xl text-sm font-semibold hover:border-accent/30 hover:text-accent transition-all">
                    <Play size={14} /> Start Anyway
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ─ Reading: room active ─ */}
          {currentRoom.status === 'reading' && (
            lateJoiner && uploadState !== 'confirmed' && bookInfo ? (
              /* Late joiner: upload to enter the session */
              <motion.div key="late-join-panel" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl p-5 space-y-4">

                <div className="flex items-center gap-2 px-3 py-2 bg-accent/8 border border-accent/20 rounded-2xl">
                  <UserPlus size={15} className="text-accent flex-shrink-0" />
                  <p className="text-xs text-accent font-semibold">Session in progress — upload to join</p>
                </div>

                <div className="flex gap-3 p-3 bg-[var(--surface-2)] rounded-2xl">
                  <div className="w-12 h-14 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <BookOpen size={18} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate">{bookInfo.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{bookInfo.filename}</p>
                    <p className="text-xs text-[var(--text-muted)]">{(bookInfo.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>

                {error && <p className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{error}</p>}

                <div className="text-center space-y-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Upload the same PDF to join</p>
                  <p className="text-xs text-[var(--text-muted)]">Your reading will sync automatically once uploaded.</p>
                </div>

                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && handleLateJoinerFileSelect(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadState === 'uploading'}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent/90 disabled:opacity-60 transition-all">
                  {uploadState === 'uploading'
                    ? <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                    : <><Upload size={16} /> Upload & Join Session</>}
                </button>
              </motion.div>
            ) : (
              /* Normal: all confirmed, transitioning to reader */
              <motion.div key="reading-panel" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-3xl p-5 flex flex-col items-center gap-3">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">All set! Opening the book…</p>
                <Loader2 size={18} className="animate-spin text-emerald-500" />
              </motion.div>
            )
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
