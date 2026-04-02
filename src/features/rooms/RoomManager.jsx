import { useState, useEffect } from 'react'
import { Users, Plus, LogIn, Copy, Check, ArrowLeft } from 'lucide-react'
import { Modal } from '../../components/UI/Modal'
import { Button } from '../../components/UI/Button'
import { useRoomStore } from '../../store/roomStore'
import { useUserStore } from '../../store/userStore'
import { syncService } from '../../services/syncService'
import { generateRoomId } from '../../utils/idGenerator'
import { getUserInitials } from '../../utils/colorUtils'

export const RoomManager = ({ open, onClose, onRoomJoined }) => {
  const [mode, setMode] = useState('choose')
  const [joinCode, setJoinCode] = useState('')
  const [newRoom, setNewRoom] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const { createRoom, joinRoom, getRoomById, currentRoom, leaveRoom } = useRoomStore()
  const { user } = useUserStore()

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      if (!currentRoom) {
        setMode('choose')
        setJoinCode('')
        setNewRoom(null)
        setError('')
        setCopied(false)
      } else {
        setMode('active')
      }
    }
  }, [open, currentRoom])

  const handleCreate = () => {
    if (!user) return
    const roomId = generateRoomId()
    const room = createRoom(roomId, user.clientId, user.username, user.avatarColor)
    syncService.destroy()
    syncService.init(roomId, user.clientId)
    setNewRoom(room)
    setMode('created')
  }

  const handleJoin = () => {
    setError('')
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    if (code.length < 4) { setError('Please enter a valid room code'); return }
    if (!user) return

    const existingRoom = getRoomById(code)
    const baseRoom = existingRoom || {
      roomId: code, users: [], roles: {},
      currentPage: 0, scrollPosition: 0, highlights: [], cursors: {},
    }
    const room = joinRoom(baseRoom, user.clientId, user.username, user.avatarColor)
    syncService.destroy()
    syncService.init(code, user.clientId)
    onRoomJoined?.(room)
    onClose()
  }

  const handleEnterRoom = () => {
    if (!newRoom) return
    onRoomJoined?.(newRoom)
    onClose()
  }

  const handleCopy = () => {
    const code = newRoom?.roomId || currentRoom?.roomId
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleLeave = () => {
    syncService.send('user_leave', {})
    syncService.destroy()
    leaveRoom()
    setMode('choose')
    onClose()
  }

  const title = mode === 'active' ? 'Your Room' : mode === 'created' ? 'Room Created' : 'Reading Rooms'

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">

      {/* ── Choose action ── */}
      {mode === 'choose' && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Read together in real-time. Share your room code and sync your reading experience.
          </p>
          <Button variant="primary" size="md" className="w-full" icon={<Plus size={16} />} onClick={handleCreate}>
            Create New Room
          </Button>
          <Button variant="secondary" size="md" className="w-full" icon={<LogIn size={16} />} onClick={() => setMode('join')}>
            Join with Room Code
          </Button>
        </div>
      )}

      {/* ── Join form ── */}
      {mode === 'join' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">Enter the room code shared by your reading partner:</p>
          <input
            type="text"
            placeholder="XXXX-XXXX"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={9}
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/50"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" icon={<ArrowLeft size={14} />} onClick={() => setMode('choose')}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleJoin}>
              Join Room
            </Button>
          </div>
        </div>
      )}

      {/* ── Newly created room ── */}
      {mode === 'created' && newRoom && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="text-4xl">🎉</div>
            <p className="font-semibold text-[var(--text-primary)]">Room is ready!</p>
            <p className="text-xs text-[var(--text-secondary)]">Share this code with your reading partners:</p>
          </div>

          <div className="flex items-center gap-2 bg-[var(--surface-2)] rounded-xl p-4 border border-[var(--border)]">
            <span className="flex-1 text-center text-2xl font-mono font-bold tracking-widest text-[var(--text-primary)]">
              {newRoom.roomId}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>

          <div className="bg-[var(--surface-1)] rounded-xl p-3 text-xs text-[var(--text-muted)] space-y-1">
            <p className="font-medium text-[var(--text-secondary)]">How it works:</p>
            <p>1. Share the room code with others</p>
            <p>2. Click "Enter Room" to activate the session</p>
            <p>3. Upload or select a PDF to start reading together</p>
          </div>

          <Button
            variant="primary"
            className="w-full"
            icon={<Users size={16} />}
            onClick={handleEnterRoom}
          >
            Enter Room →
          </Button>
        </div>
      )}

      {/* ── Already in a room ── */}
      {mode === 'active' && currentRoom && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-[var(--surface-2)] rounded-xl p-4 border border-[var(--border)]">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-0.5">Room Code</p>
              <span className="text-xl font-mono font-bold tracking-widest text-[var(--text-primary)]">
                {currentRoom.roomId}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="ml-auto p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)]"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
              Members ({currentRoom.users?.length || 1})
            </p>
            {currentRoom.users?.map(u => (
              <div key={u.clientId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {getUserInitials(u.username)}
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                  {u.username}
                  {u.clientId === user?.clientId && (
                    <span className="text-[var(--text-muted)] text-xs"> (you)</span>
                  )}
                </span>
                <span className={`ml-auto text-xs ${u.isOnline ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
                  {u.isOnline ? 'online' : 'offline'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-red-500 hover:bg-red-50"
              onClick={handleLeave}
            >
              Leave Room
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
