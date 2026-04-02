import { useEffect, useRef, useCallback } from 'react'
import { syncService, SYNC_EVENTS } from '../services/syncService'
import { useRoomStore } from '../store/roomStore'
import { useReaderStore } from '../store/readerStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useUserStore } from '../store/userStore'
import { useChatStore } from '../store/chatStore'
import { resolveScrollConflict } from '../utils/conflictResolver'

export const useSync = () => {
  const { currentRoom, updateRoomState, addUserToRoom, removeUserFromRoom,
    updateCursor, updateHeartbeat, purgeStaleUsers, promoteUser,
    setRequestedBook, setBookForRoom } = useRoomStore()
  const { setCurrentPage } = useReaderStore()
  const { mergeRemoteHighlights } = useAnnotationStore()
  const { user, preferences } = useUserStore()
  const { addMessage, incrementUnread } = useChatStore()
  const chatPanelOpenRef = useRef(false)

  const pendingScrollUpdates = useRef([])
  const heartbeatInterval = useRef(null)
  const onScrollApply = useRef(null)

  const handleIncoming = useCallback((event) => {
    switch (event.type) {
      case SYNC_EVENTS.SCROLL: {
        if (preferences.syncLocked) {
          pendingScrollUpdates.current.push({
            scrollPosition: event.scrollPosition,
            role: event.role,
            timestamp: event.timestamp,
            clientId: event.clientId,
          })
        }
        break
      }
      case SYNC_EVENTS.PAGE_CHANGE: {
        if (preferences.syncLocked) {
          setCurrentPage(event.page)
          updateRoomState({ currentPage: event.page })
        }
        break
      }
      case SYNC_EVENTS.CURSOR: {
        updateCursor(event.clientId, { x: event.x, y: event.y, page: event.page })
        break
      }
      case SYNC_EVENTS.HIGHLIGHT_ADD: {
        if (event.bookId && event.highlight) {
          mergeRemoteHighlights(event.bookId, [event.highlight])
        }
        break
      }
      case SYNC_EVENTS.USER_JOIN: {
        addUserToRoom({
          clientId: event.clientId,
          username: event.username,
          avatarColor: event.avatarColor,
          role: event.role || 'viewer',
          lastSeen: event.timestamp,
          isOnline: true,
        })
        break
      }
      case SYNC_EVENTS.USER_LEAVE: {
        removeUserFromRoom(event.clientId)
        break
      }
      case SYNC_EVENTS.HEARTBEAT: {
        updateHeartbeat(event.clientId)
        addUserToRoom({
          clientId: event.clientId,
          username: event.username,
          avatarColor: event.avatarColor,
          role: event.role || 'viewer',
          lastSeen: event.timestamp,
          isOnline: true,
        })
        break
      }
      case SYNC_EVENTS.ROLE_UPDATE: {
        if (event.targetClientId && event.newRole) {
          promoteUser(event.targetClientId, event.newRole)
        }
        break
      }
      case SYNC_EVENTS.BOOK_SET: {
        if (event.bookId) {
          // Update room state so everyone knows which book is active
          updateRoomState({ bookId: event.bookId })
          // Tell the visitor's UI to show the "upload to sync" prompt
          setRequestedBook({
            bookId:       event.bookId,
            title:        event.title    || 'Unknown Book',
            filename:     event.filename || '',
            size:         event.size     || 0,
            fromUsername: event.senderUsername || 'Your partner',
          })
        }
        break
      }
      case SYNC_EVENTS.CHAT_MESSAGE: {
        if (event.roomId && event.message) {
          addMessage(event.roomId, event.message)
          if (!chatPanelOpenRef.current) {
            incrementUnread(event.roomId)
          }
        }
        break
      }
      default: break
    }
  }, [preferences.syncLocked, setCurrentPage, updateRoomState,
    addUserToRoom, removeUserFromRoom, updateCursor, updateHeartbeat, promoteUser,
    mergeRemoteHighlights, addMessage, incrementUnread,
    setRequestedBook])

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingScrollUpdates.current.length === 0) return
      const winner = resolveScrollConflict(pendingScrollUpdates.current)
      if (winner) {
        updateRoomState({ scrollPosition: winner.scrollPosition })
        onScrollApply.current?.(winner.scrollPosition)
      }
      pendingScrollUpdates.current = []
    }, 50)

    return () => clearInterval(interval)
  }, [updateRoomState])

  useEffect(() => {
    if (!currentRoom || !user) return

    const unsubAll = syncService.on('*', handleIncoming)

    syncService.send(SYNC_EVENTS.USER_JOIN, {
      username: user.username,
      avatarColor: user.avatarColor,
      role: currentRoom.roles?.[user.clientId] || 'viewer',
    })

    heartbeatInterval.current = setInterval(() => {
      syncService.send(SYNC_EVENTS.HEARTBEAT, {
        username: user.username,
        avatarColor: user.avatarColor,
        role: currentRoom.roles?.[user.clientId] || 'viewer',
      })
      purgeStaleUsers()
    }, 10000)

    return () => {
      unsubAll()
      clearInterval(heartbeatInterval.current)
      syncService.send(SYNC_EVENTS.USER_LEAVE, {})
    }
  }, [currentRoom?.roomId, user?.clientId])

  const sendScroll = useCallback((scrollPosition) => {
    if (!currentRoom || !user) return
    const role = currentRoom.roles?.[user.clientId] || 'viewer'
    if (role === 'viewer') return
    syncService.send(SYNC_EVENTS.SCROLL, { scrollPosition, role }, { throttle: 32 })
  }, [currentRoom, user])

  const sendPageChange = useCallback((page) => {
    if (!currentRoom || !user) return
    const role = currentRoom.roles?.[user.clientId] || 'viewer'
    if (role === 'viewer') return
    syncService.send(SYNC_EVENTS.PAGE_CHANGE, { page })
  }, [currentRoom, user])

  const sendCursor = useCallback((x, y, page) => {
    if (!currentRoom) return
    syncService.send(SYNC_EVENTS.CURSOR, { x, y, page }, { throttle: 50 })
  }, [currentRoom])

  const sendHighlight = useCallback((bookId, highlight) => {
    if (!currentRoom) return
    syncService.send(SYNC_EVENTS.HIGHLIGHT_ADD, { bookId, highlight })
  }, [currentRoom])

  const registerScrollApply = useCallback((fn) => {
    onScrollApply.current = fn
  }, [])

  /**
   * Called by the owner/reader when they open a PDF in a room.
   * Broadcasts the book metadata so visitors can be prompted to upload the same file.
   */
  const sendBookSet = useCallback((bookId, title, filename, size) => {
    if (!currentRoom || !user) return
    // Record it locally in room state so it persists for late joiners
    setBookForRoom(bookId)
    syncService.send(SYNC_EVENTS.BOOK_SET, {
      bookId,
      title,
      filename,
      size,
      senderUsername: user.username,
    })
  }, [currentRoom, user, setBookForRoom])

  const sendChatMessage = useCallback((text) => {
    if (!currentRoom || !user || !text.trim()) return null
    const message = {
      clientId: user.clientId,
      username: user.username,
      avatarColor: user.avatarColor,
      text: text.trim(),
    }
    // Add to own store first
    addMessage(currentRoom.roomId, message)
    // Broadcast to other tabs
    syncService.send(SYNC_EVENTS.CHAT_MESSAGE, {
      roomId: currentRoom.roomId,
      message,
    })
    return message
  }, [currentRoom, user, addMessage])

  /** Let the chat panel tell the sync hook whether it's visible (affects unread counter) */
  const setChatPanelOpen = useCallback((open) => {
    chatPanelOpenRef.current = open
  }, [])

  return { sendScroll, sendPageChange, sendCursor, sendHighlight, registerScrollApply, sendChatMessage, setChatPanelOpen, sendBookSet }
}
