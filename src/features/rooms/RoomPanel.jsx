/**
 * RoomPanel — slide-in sidebar showing participants and role controls.
 *
 * Role logic (new):
 *  - There is ONE active controller at a time (activeControllerId).
 *  - The controller can "Transfer Control" to any viewer/participant.
 *  - When they do, they become a viewer and the new person becomes controller.
 *  - The original creator (ownerId) is marked with a Crown badge for display,
 *    but functionally they follow activeControllerId like everyone else.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Copy, Check, LogOut, Crown, Eye, BookOpen,
  UserCheck, ChevronDown,
} from 'lucide-react'
import { useRoomStore } from '../../store/roomStore'
import { useUserStore } from '../../store/userStore'
import { socketService } from '../../services/socketService'
import { IconButton, Button } from '../../components/UI/Button'
import { getUserInitials } from '../../utils/colorUtils'

const Avatar = ({ user, size = 8 }) => (
  <div
    className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 relative text-xs`}
    style={{ backgroundColor: user.avatarColor }}
    title={user.username}
  >
    {getUserInitials(user.username)}
    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-0)]
      ${user.isOnline ? 'bg-emerald-400' : 'bg-[var(--surface-3)]'}`} />
  </div>
)

export const RoomPanel = ({ open, onClose }) => {
  const { currentRoom, leaveRoom, applyRoleUpdate } = useRoomStore()
  const { user } = useUserStore()
  const [copied,       setCopied]       = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)

  if (!currentRoom) return null

  const participants  = currentRoom.participants || []
  const isController  = currentRoom.activeControllerId === user?.clientId
  const isOwner       = currentRoom.ownerId === user?.clientId
  const onlineCount   = participants.filter(p => p.isOnline).length

  const enriched = participants.map(p =>
    p.clientId === user?.clientId ? { ...p, isOnline: true } : p
  )

  const copyCode = () => {
    navigator.clipboard.writeText(currentRoom.roomId).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleLeave = () => {
    socketService.leaveRoom()
    leaveRoom()
    onClose()
  }

  const handleTransferControl = (toClientId) => {
    socketService.transferControl(toClientId)
    setExpandedUser(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity:0, x:280 }}
          animate={{ opacity:1, x:0 }}
          exit={{ opacity:0, x:280 }}
          transition={{ type:'spring', damping:26, stiffness:300 }}
          className="absolute right-0 top-0 bottom-0 w-72 bg-[var(--surface-0)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] z-30 flex flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Reading Room</h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{onlineCount} online · {participants.length} total</p>
            </div>
            <IconButton onClick={onClose} variant="ghost"><X size={16} /></IconButton>
          </div>

          {/* Room code */}
          <div className="mx-3 my-2 flex items-center gap-2 bg-[var(--surface-2)] rounded-xl px-3 py-2.5 border border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">Room Code</p>
              <p className="text-base font-mono font-bold tracking-widest text-[var(--text-primary)]">
                {currentRoom.roomId}
              </p>
            </div>
            <button onClick={copyCode}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Copy code">
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Role info banner */}
          <div className={`mx-3 mb-2 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${
            isController
              ? 'bg-accent/10 text-accent border border-accent/20'
              : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]'
          }`}>
            {isController
              ? <><BookOpen size={12} /> You are controlling the reading</>
              : <><Eye      size={12} /> Viewing — follow along</>
            }
          </div>

          {/* Participants */}
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-1 mb-2">
              Participants ({enriched.length})
            </p>
            <div className="space-y-0.5">
              {enriched.map(p => {
                const isMe     = p.clientId === user?.clientId
                const isOwnerP = p.clientId === currentRoom.ownerId
                const isCtrl   = p.clientId === currentRoom.activeControllerId
                const expanded = expandedUser === p.clientId

                return (
                  <div key={p.clientId}>
                    <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                      isMe ? 'bg-accent/8 border border-accent/15' : 'hover:bg-[var(--surface-2)]'
                    }`}>
                      <Avatar user={p} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[100px]">
                            {p.username}
                          </span>
                          {isMe && (
                            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium flex-shrink-0">you</span>
                          )}
                          {isOwnerP && (
                            <span className="text-[10px] flex items-center gap-0.5 text-amber-500 flex-shrink-0">
                              <Crown size={9} /> Owner
                            </span>
                          )}
                          {isCtrl && (
                            <span className="text-[10px] flex items-center gap-0.5 text-accent flex-shrink-0">
                              <BookOpen size={9} /> Controller
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] ${p.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                          {p.isOnline ? 'online' : 'offline'}
                        </p>
                      </div>

                      {/* Only the current controller can transfer control to others */}
                      {isController && !isMe && (
                        <button
                          className="p-1 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] transition-colors"
                          onClick={() => setExpandedUser(expanded ? null : p.clientId)}>
                          <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Transfer control action */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                          className="overflow-hidden pl-10 pr-2 pb-1">
                          <div className="py-1">
                            <button
                              onClick={() => handleTransferControl(p.clientId)}
                              className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-accent bg-accent/8 hover:bg-accent/15 transition-colors flex items-center gap-2">
                              <UserCheck size={12} />
                              Transfer Control to {p.username}
                            </button>
                            <p className="text-[10px] text-[var(--text-muted)] px-1 mt-1.5 leading-relaxed">
                              They'll control scrolling &amp; highlights. You'll become a viewer.
                            </p>
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
            <Button variant="ghost" size="sm"
              className="w-full text-red-500 hover:bg-red-500/8 justify-center"
              icon={<LogOut size={14} />}
              onClick={handleLeave}>
              Leave Room
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
