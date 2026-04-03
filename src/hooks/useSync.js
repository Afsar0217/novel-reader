/**
 * useSync — wires socketService events to Zustand stores.
 * Lives in App.jsx (always active while in a room).
 * Returns send-functions for the reader view.
 */
import { useEffect, useCallback, useRef } from 'react'
import { socketService } from '../services/socketService'
import { useRoomStore }   from '../store/roomStore'
import { useReaderStore } from '../store/readerStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useUserStore }   from '../store/userStore'
import { useChatStore }   from '../store/chatStore'

export const useSync = () => {
  const {
    currentRoom, setParticipants, patchRoom, applyRoleUpdate, leaveRoom,
  } = useRoomStore()

  const { setCurrentPage }         = useReaderStore()
  const { mergeRemoteHighlights }  = useAnnotationStore()
  const { user }                   = useUserStore()
  const { addMessage }             = useChatStore()

  const chatOpenRef = useRef(false)

  /* ── Subscribe to server events ─────────────────────────────── */
  useEffect(() => {
    if (!currentRoom || !user) return

    const unsubs = [
      // Server emits the participants array directly (not wrapped in an object)
      socketService.on('room:participants', (data) => {
        const p = Array.isArray(data) ? data : (data?.participants ?? [])
        setParticipants(p)
      }),

      socketService.on('room:deleted', () => {
        leaveRoom()
        socketService.disconnect()
      }),

      socketService.on('sync:page', ({ page }) => {
        setCurrentPage(page)
        patchRoom({ currentPage: page })
      }),

      socketService.on('sync:highlight', ({ bookId, highlight }) => {
        mergeRemoteHighlights(bookId, [highlight])
      }),

      socketService.on('role:update', (data) => {
        applyRoleUpdate(data)
      }),

      socketService.on('chat:message', ({ message }) => {
        addMessage(currentRoom.roomId, message)
      }),
    ]

    return () => unsubs.forEach(u => u())
  }, [currentRoom?.roomId, user?.clientId])

  /* ── Send helpers ────────────────────────────────────────────── */
  const amController = useCallback(() => {
    if (!currentRoom || !user) return false
    return currentRoom.activeControllerId === user.clientId
  }, [currentRoom, user])

  const sendScroll = useCallback((scrollPosition) => {
    if (!amController()) return
    socketService.sendScroll(scrollPosition)
  }, [amController])

  const sendPageChange = useCallback((page) => {
    if (!amController()) return
    socketService.sendPage(page)
  }, [amController])

  const sendCursor = useCallback((x, y, page) => {
    socketService.sendCursor(x, y, page)
  }, [])

  const sendHighlight = useCallback((bookId, highlight) => {
    if (!amController()) return
    socketService.sendHighlight(bookId, highlight)
  }, [amController])

  const sendChatMessage = useCallback((text) => {
    if (!currentRoom || !user || !text.trim()) return
    const message = {
      clientId:    user.clientId,
      username:    user.username,
      avatarColor: user.avatarColor,
      text:        text.trim(),
    }
    addMessage(currentRoom.roomId, message)
    socketService.sendChatMessage(message)
  }, [currentRoom, user, addMessage])

  const setChatPanelOpen = useCallback((open) => {
    chatOpenRef.current = open
  }, [])

  return {
    sendScroll,
    sendPageChange,
    sendCursor,
    sendHighlight,
    sendChatMessage,
    setChatPanelOpen,
  }
}
