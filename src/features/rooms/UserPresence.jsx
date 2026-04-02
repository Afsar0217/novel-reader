import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRemoteCursors } from '../../hooks/usePresence'
import { getUserInitials } from '../../utils/colorUtils'

export const RemoteCursors = memo(() => {
  const cursors = useRemoteCursors()

  return (
    <AnimatePresence>
      {cursors.map(cursor => (
        <motion.div
          key={cursor.clientId}
          className="presence-cursor"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, left: cursor.x, top: cursor.y }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          style={{ left: cursor.x, top: cursor.y }}
        >
          <div
            className="presence-cursor-pointer"
            style={{ backgroundColor: cursor.color }}
          />
          <div
            className="presence-cursor-label"
            style={{ backgroundColor: cursor.color }}
          >
            {getUserInitials(cursor.username)}
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
})

RemoteCursors.displayName = 'RemoteCursors'

export const PresenceAvatars = ({ users = [], maxVisible = 4 }) => {
  const visible = users.filter(u => u.isOnline).slice(0, maxVisible)
  const overflow = Math.max(0, users.filter(u => u.isOnline).length - maxVisible)

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map(u => (
        <div
          key={u.clientId}
          className="w-7 h-7 rounded-full border-2 border-[var(--surface-0)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: u.avatarColor }}
          title={u.username}
        >
          {getUserInitials(u.username)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-[var(--surface-0)] bg-[var(--surface-3)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">
          +{overflow}
        </div>
      )}
    </div>
  )
}
