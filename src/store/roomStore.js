import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'syncRead_rooms'

export const useRoomStore = create(
  persist(
    (set, get) => ({
      currentRoom: null,
      rooms: {},
      /**
       * Set by useSync when a BOOK_SET event arrives from a room member.
       * Tells the visitor which book the owner just opened.
       * { bookId, title, filename, size, fromUsername }
       */
      requestedBook: null,

      createRoom: (roomId, userId, username, avatarColor) => {
        const room = {
          roomId,
          createdAt: Date.now(),
          users: [{
            clientId: userId,
            username,
            avatarColor,
            role: 'owner',
            lastSeen: Date.now(),
            isOnline: true,
          }],
          roles: { [userId]: 'owner' },
          currentPage: 0,
          scrollPosition: 0,
          highlights: [],
          cursors: {},
          bookId: null,
        }
        set(state => ({
          currentRoom: room,
          rooms: { ...state.rooms, [roomId]: room },
        }))
        return room
      },

      joinRoom: (roomData, userId, username, avatarColor) => {
        const existingRole = roomData.roles?.[userId]
        const role = existingRole || 'reader'
        const updatedRoom = {
          ...roomData,
          users: [
            ...(roomData.users || []).filter(u => u.clientId !== userId),
            {
              clientId: userId,
              username,
              avatarColor,
              role,
              lastSeen: Date.now(),
              isOnline: true,
            },
          ],
          roles: { ...(roomData.roles || {}), [userId]: role },
        }
        set(state => ({
          currentRoom: updatedRoom,
          rooms: { ...state.rooms, [roomData.roomId]: updatedRoom },
        }))
        return updatedRoom
      },

      leaveRoom: () => {
        set({ currentRoom: null })
      },

      updateRoomState: (delta) => {
        set(state => {
          if (!state.currentRoom) return state
          const updated = { ...state.currentRoom, ...delta }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      addUserToRoom: (user) => {
        set(state => {
          if (!state.currentRoom) return state
          const users = [
            ...state.currentRoom.users.filter(u => u.clientId !== user.clientId),
            user,
          ]
          const updated = { ...state.currentRoom, users }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      removeUserFromRoom: (clientId) => {
        set(state => {
          if (!state.currentRoom) return state
          const users = state.currentRoom.users.filter(u => u.clientId !== clientId)
          const updated = { ...state.currentRoom, users }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      promoteUser: (clientId, newRole) => {
        set(state => {
          if (!state.currentRoom) return state
          const users = state.currentRoom.users.map(u =>
            u.clientId === clientId ? { ...u, role: newRole } : u
          )
          const roles = { ...state.currentRoom.roles, [clientId]: newRole }
          const updated = { ...state.currentRoom, users, roles }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      updateCursor: (clientId, position) => {
        set(state => {
          if (!state.currentRoom) return state
          const cursors = {
            ...state.currentRoom.cursors,
            [clientId]: { ...position, timestamp: Date.now() },
          }
          const updated = { ...state.currentRoom, cursors }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      updateHeartbeat: (clientId) => {
        set(state => {
          if (!state.currentRoom) return state
          const users = state.currentRoom.users.map(u =>
            u.clientId === clientId ? { ...u, lastSeen: Date.now(), isOnline: true } : u
          )
          const updated = { ...state.currentRoom, users }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      purgeStaleUsers: () => {
        const TIMEOUT = 30000
        set(state => {
          if (!state.currentRoom) return state
          const now = Date.now()
          const users = state.currentRoom.users.map(u => ({
            ...u,
            isOnline: now - u.lastSeen < TIMEOUT,
          }))
          const updated = { ...state.currentRoom, users }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      getRoomById: (roomId) => {
        return get().rooms[roomId] || null
      },

      setBookForRoom: (bookId) => {
        set(state => {
          if (!state.currentRoom) return state
          const updated = { ...state.currentRoom, bookId }
          return {
            currentRoom: updated,
            rooms: { ...state.rooms, [updated.roomId]: updated },
          }
        })
      },

      setRequestedBook: (book) => set({ requestedBook: book }),
      clearRequestedBook: () => set({ requestedBook: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ rooms: state.rooms }),
    }
  )
)
