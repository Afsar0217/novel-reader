import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle, X, Smile } from 'lucide-react'
import { useRoomStore } from '../../store/roomStore'
import { useUserStore } from '../../store/userStore'
import { useChatStore } from '../../store/chatStore'
import { getUserInitials } from '../../utils/colorUtils'

/* ── Quick emoji reactions ── */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '📖', '✨', '👀']

const formatTime = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/* ── Group consecutive messages from the same sender ── */
const groupMessages = (messages) => {
  const groups = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    if (last && last.clientId === msg.clientId && msg.timestamp - last.messages[last.messages.length - 1].timestamp < 120000) {
      last.messages.push(msg)
    } else {
      groups.push({ clientId: msg.clientId, username: msg.username, avatarColor: msg.avatarColor, messages: [msg] })
    }
  }
  return groups
}

/* ── Single message bubble ── */
const MessageBubble = ({ group, isMe }) => {
  const [showTime, setShowTime] = useState(false)

  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar (shown once per group) */}
      {!isMe && (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-auto"
          style={{ backgroundColor: group.avatarColor }}
          title={group.username}
        >
          {getUserInitials(group.username)}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name (not for self) */}
        {!isMe && (
          <span className="text-[10px] text-[var(--text-muted)] font-medium px-1">
            {group.username}
          </span>
        )}

        {group.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`relative group cursor-default ${isMe ? 'items-end' : 'items-start'}`}
            onClick={() => setShowTime(s => !s)}
          >
            <div
              className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                isMe
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-[var(--surface-2)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--border)]'
              } ${i < group.messages.length - 1 ? (isMe ? 'rounded-br-2xl' : 'rounded-bl-2xl') : ''}`}
            >
              {msg.text}
            </div>

            {/* Timestamp on tap/hover */}
            {showTime && i === group.messages.length - 1 && (
              <span className="text-[9px] text-[var(--text-muted)] px-1 mt-0.5 block">
                {formatTime(msg.timestamp)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Own avatar */}
      {isMe && (
        <div
          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-auto"
          style={{ backgroundColor: group.avatarColor }}
        >
          {getUserInitials(group.username)}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   ROOM CHAT PANEL
════════════════════════════════════════════ */
export const RoomChat = ({ open, onClose, sendChatMessage, setChatPanelOpen }) => {
  const { currentRoom } = useRoomStore()
  const { user } = useUserStore()
  const { getMessages, markRead } = useChatStore()

  const [text, setText] = useState('')
  const [showEmojis, setShowEmojis] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const roomId   = currentRoom?.roomId
  const messages = roomId ? getMessages(roomId) : []
  const groups   = groupMessages(messages)

  // Mark as read & focus input when panel opens
  useEffect(() => {
    if (open && roomId) {
      markRead(roomId)
      setChatPanelOpen?.(true)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
    return () => setChatPanelOpen?.(false)
  }, [open, roomId])

  // Scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, open])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendChatMessage?.(trimmed)
    setText('')
    setShowEmojis(false)
    inputRef.current?.focus()
  }, [text, sendChatMessage])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') onClose?.()
  }

  const addEmoji = (emoji) => {
    setText(t => t + emoji)
    inputRef.current?.focus()
  }

  /* Date dividers between groups on different days */
  const withDividers = []
  let lastDate = null
  for (const group of groups) {
    const d = formatDate(group.messages[0].timestamp)
    if (d !== lastDate) { withDividers.push({ type: 'divider', label: d }); lastDate = d }
    withDividers.push({ type: 'group', group })
  }

  if (!currentRoom) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 320 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 320 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="absolute inset-y-0 right-0 w-full sm:w-80 bg-[var(--surface-0)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] z-30 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
            <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center">
              <MessageCircle size={14} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Room Chat</h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                {currentRoom.users?.length ?? 1} participant{(currentRoom.users?.length ?? 1) !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {withDividers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center">
                  <MessageCircle size={24} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">No messages yet</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Start the conversation!</p>
                </div>
              </div>
            )}

            {withDividers.map((item, i) =>
              item.type === 'divider' ? (
                <div key={`d-${i}`} className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--text-muted)] font-medium px-2 bg-[var(--surface-0)]">
                    {item.label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              ) : (
                <MessageBubble
                  key={item.group.messages[0].id}
                  group={item.group}
                  isMe={item.group.clientId === user?.clientId}
                />
              )
            )}
            <div ref={bottomRef} />
          </div>

          {/* Emoji picker */}
          <AnimatePresence>
            {showEmojis && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="px-3 pb-2 flex flex-wrap gap-1.5"
              >
                {QUICK_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => addEmoji(e)}
                    className="text-lg w-8 h-8 rounded-xl hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] flex-shrink-0">
            <div className="flex items-end gap-2 bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl px-3 py-2 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message the room…"
                rows={1}
                maxLength={500}
                className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none max-h-24 leading-relaxed"
                style={{ minHeight: '1.5rem' }}
              />
              <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                <button
                  onClick={() => setShowEmojis(s => !s)}
                  className={`p-1 rounded-lg transition-colors ${
                    showEmojis ? 'text-accent' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                  title="Emoji"
                >
                  <Smile size={15} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="w-7 h-7 rounded-xl bg-accent disabled:bg-[var(--surface-3)] flex items-center justify-center transition-all hover:bg-accent/90 disabled:cursor-not-allowed"
                  title="Send (Enter)"
                >
                  <Send size={13} className={text.trim() ? 'text-white' : 'text-[var(--text-muted)]'} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/* ── Unread badge ── */
export const ChatUnreadBadge = ({ roomId }) => {
  const { getUnread } = useChatStore()
  const count = getUnread(roomId)
  if (!count) return null
  return (
    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}
