import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, LogOut, ChevronDown, Crown, Eye, BookOpen } from 'lucide-react'
import { useRoomStore } from '../../store/roomStore'
import { useUserStore } from '../../store/userStore'
import { syncService, SYNC_EVENTS } from '../../services/syncService'
import { IconButton, Button } from '../../components/UI/Button'
import { getUserInitials } from '../../utils/colorUtils'

const ROLE_META = {
  owner:  { icon: <Crown  size={11} />, label: 'Owner',  color: 'text-amber-500' },
  reader: { icon: <BookOpen size={11}/>, label: 'Reader', color: 'text-accent'    },
  viewer: { icon: <Eye    size={11} />, label: 'Viewer', color: 'text-[var(--text-muted)]' },
}

const Avatar = ({ user, size = 8 }) => (
  <div
    className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 relative text-xs`}
    style={{ backgroundColor: user.avatarColor }}
    title={user.username}
  >
    {getUserInitials(user.username)}
    <div
      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-0)] ${
        user.isOnline ? 'bg-emerald-400' : 'bg-[var(--surface-3)]'
      }`}
    />
  </div>
)

export const RoomPanel = ({ open, onClose }) => {
  const { currentRoom, leaveRoom, promoteUser } = useRoomStore()
  const { user } = useUserStore()
  const [copied, setCopied] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)

  if (!currentRoom) return null

  const myRole = currentRoom.roles?.[user?.clientId] || 'viewer'
  const isOwner = myRole === 'owner'
  const allUsers = currentRoom.users || []

  // Ensure current user always shows as online in their own panel
  const enrichedUsers = allUsers.map(u =>
    u.clientId === user?.clientId ? { ...u, isOnline: true } : u
  )
  const onlineCount = enrichedUsers.filter(u => u.isOnline).length

  const copyCode = () => {
    navigator.clipboard.writeText(currentRoom.roomId).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleLeave = () => {
    syncService.send(SYNC_EVENTS.USER_LEAVE, {})
    syncService.destroy()
    leaveRoom()
    onClose()
  }

  const handlePromote = (targetId, newRole) => {
    promoteUser(targetId, newRole)
    syncService.send(SYNC_EVENTS.ROLE_UPDATE, { targetClientId: targetId, newRole })
    setExpandedUser(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 280 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 280 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-72 bg-[var(--surface-0)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] z-30 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Reading Room</h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{onlineCount} online</p>
            </div>
            <IconButton onClick={onClose} variant="ghost">
              <X size={16} />
            </IconButton>
          </div>

          {/* Room code */}
          <div className="mx-3 my-2 flex items-center gap-2 bg-[var(--surface-2)] rounded-xl px-3 py-2.5 border border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">Room Code</p>
              <p className="text-base font-mono font-bold tracking-widest text-[var(--text-primary)]">
                {currentRoom.roomId}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Users list */}
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1 mb-2">
              Participants ({enrichedUsers.length})
            </p>

            <div className="space-y-0.5">
              {enrichedUsers.map(roomUser => {
                const isMe = roomUser.clientId === user?.clientId
                const role = currentRoom.roles?.[roomUser.clientId] || 'viewer'
                const meta = ROLE_META[role] || ROLE_META.viewer
                const isExpanded = expandedUser === roomUser.clientId

                return (
                  <div key={roomUser.clientId}>
                    <div
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                        isMe ? 'bg-accent/8 border border-accent/15' : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <Avatar user={roomUser} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {roomUser.username}
                          </span>
                          {isMe && (
                            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                              you
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] ${meta.color}`}>
                          {meta.icon}
                          <span>{meta.label}</span>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className={roomUser.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}>
                            {roomUser.isOnline ? 'online' : 'offline'}
                          </span>
                        </div>
                      </div>

                      {isOwner && !isMe && (
                        <button
                          className="p-1 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] transition-colors"
                          onClick={() => setExpandedUser(isExpanded ? null : roomUser.clientId)}
                        >
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-10 pr-2 pb-1"
                        >
                          <div className="space-y-1 py-1">
                            {['owner', 'reader', 'viewer'].map(r => (
                              <button
                                key={r}
                                onClick={() => handlePromote(roomUser.clientId, r)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                                  role === r
                                    ? 'bg-accent/10 text-accent font-medium'
                                    : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {ROLE_META[r].icon} Set as {ROLE_META[r].label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border)] flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live sync active
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-500 hover:bg-red-500/8 justify-center"
              icon={<LogOut size={14} />}
              onClick={handleLeave}
            >
              Leave Room
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
