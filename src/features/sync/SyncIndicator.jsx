import { motion } from 'framer-motion'
import { Lock, Unlock, Wifi, WifiOff } from 'lucide-react'
import { useUserStore } from '../../store/userStore'
import { useRoomStore } from '../../store/roomStore'
import { PresenceAvatars } from '../rooms/UserPresence'

export const SyncIndicator = ({ onClick }) => {
  const { preferences } = useUserStore()
  const { currentRoom } = useRoomStore()

  if (!currentRoom) return null

  const onlineUsers = currentRoom.users?.filter(u => u.isOnline) || []

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
      style={{
        background: preferences.syncLocked
          ? 'rgba(16, 185, 129, 0.12)'
          : 'rgba(245, 158, 11, 0.12)',
        color: preferences.syncLocked ? '#059669' : '#d97706',
        border: `1px solid ${preferences.syncLocked ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
      }}
      title={preferences.syncLocked ? 'Sync locked — click for free mode' : 'Free mode — click to lock sync'}
    >
      {preferences.syncLocked
        ? <><div className="sync-live-dot" style={{ background: '#10b981' }} /><span>Synced</span></>
        : <><WifiOff size={12} /><span>Free</span></>
      }
      {onlineUsers.length > 1 && (
        <>
          <span className="opacity-40">·</span>
          <PresenceAvatars users={onlineUsers} maxVisible={3} />
        </>
      )}
    </motion.button>
  )
}
