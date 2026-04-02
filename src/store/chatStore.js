import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateHighlightId } from '../utils/idGenerator'

const STORAGE_KEY = 'syncRead_chat'
const MAX_MESSAGES_PER_ROOM = 200

export const useChatStore = create(
  persist(
    (set, get) => ({
      /** { [roomId]: Message[] } */
      messages: {},
      /** { [roomId]: number } — count of unread messages per room */
      unreadCounts: {},

      addMessage: (roomId, { clientId, username, avatarColor, text }) => {
        const msg = {
          id: generateHighlightId(),
          clientId,
          username,
          avatarColor,
          text: text.trim(),
          timestamp: Date.now(),
        }

        set(state => {
          const prev = state.messages[roomId] || []
          const next = [...prev, msg].slice(-MAX_MESSAGES_PER_ROOM)
          return { messages: { ...state.messages, [roomId]: next } }
        })

        return msg
      },

      /** Called when the user opens the chat panel — reset unread for this room */
      markRead: (roomId) => {
        set(state => ({
          unreadCounts: { ...state.unreadCounts, [roomId]: 0 },
        }))
      },

      /** Increment unread for a room (called for incoming messages when panel is closed) */
      incrementUnread: (roomId) => {
        set(state => ({
          unreadCounts: {
            ...state.unreadCounts,
            [roomId]: (state.unreadCounts[roomId] || 0) + 1,
          },
        }))
      },

      getMessages: (roomId) => get().messages[roomId] || [],

      getUnread: (roomId) => get().unreadCounts[roomId] || 0,

      clearRoom: (roomId) => {
        set(state => {
          const messages = { ...state.messages }
          const unreadCounts = { ...state.unreadCounts }
          delete messages[roomId]
          delete unreadCounts[roomId]
          return { messages, unreadCounts }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ messages: state.messages }),
    }
  )
)
