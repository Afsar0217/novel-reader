import { useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useUserStore } from '../store/userStore'

export const usePresence = (sendCursor) => {
  const { currentRoom } = useRoomStore()
  const { user } = useUserStore()
  const frameRef = useRef(null)
  const lastPos = useRef({ x: -1, y: -1 })

  const handleMouseMove = useCallback((e) => {
    if (!sendCursor || !currentRoom) return

    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const x = e.clientX / window.innerWidth
      const y = e.clientY / window.innerHeight
      if (Math.abs(x - lastPos.current.x) < 0.002 &&
          Math.abs(y - lastPos.current.y) < 0.002) return
      lastPos.current = { x, y }
      sendCursor(x, y, 0)
    })
  }, [sendCursor, currentRoom])

  useEffect(() => {
    if (!currentRoom || !user) return
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(frameRef.current)
    }
  }, [handleMouseMove, currentRoom, user])
}

export const useRemoteCursors = () => {
  const { currentRoom } = useRoomStore()
  const { user } = useUserStore()

  if (!currentRoom) return []

  const now = Date.now()
  return Object.entries(currentRoom.cursors || {})
    .filter(([clientId]) => clientId !== user?.clientId)
    .map(([clientId, cursor]) => {
      const roomUser = currentRoom.users?.find(u => u.clientId === clientId)
      return {
        clientId,
        x: cursor.x * window.innerWidth,
        y: cursor.y * window.innerHeight,
        username: roomUser?.username || 'Reader',
        color: roomUser?.avatarColor || '#6366f1',
        isStale: now - cursor.timestamp > 5000,
      }
    })
    .filter(c => !c.isStale)
}
