/**
 * Room store — single source of truth for the current room.
 *
 * Room state lives on the server; this store mirrors what the server sends.
 * `currentRoomId` is persisted to localStorage so the app can rejoin after refresh.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useRoomStore = create(
  persist(
    (set, get) => ({
      /** Full room object mirrored from server */
      currentRoom: null,

      /** Persisted so we can attempt rejoin on page refresh */
      savedRoomId: null,

      /* ── Setters ───────────────────────────────────────────────── */

      /** Called when server sends the full room after join */
      setRoom: (room) => set({ currentRoom: room, savedRoomId: room.roomId }),

      /** Called when server broadcasts updated participant list */
      setParticipants: (participants) =>
        set(state => state.currentRoom
          ? { currentRoom: { ...state.currentRoom, participants } }
          : state
        ),

      /** Partial update to any room fields */
      patchRoom: (delta) =>
        set(state => state.currentRoom
          ? { currentRoom: { ...state.currentRoom, ...delta } }
          : state
        ),

      /** Called when server confirms the book is set */
      setBook: (book) =>
        set(state => state.currentRoom
          ? { currentRoom: { ...state.currentRoom, book, status: 'confirming' } }
          : state
        ),

      /** Update confirm status from server */
      setConfirmStatus: ({ confirmed, total, details }) =>
        set(state => state.currentRoom
          ? {
              currentRoom: {
                ...state.currentRoom,
                confirmations: details,
                confirmCount: confirmed,
                confirmTotal: total,
              },
            }
          : state
        ),

      /** Room is now reading */
      setReading: (data) =>
        set(state => state.currentRoom
          ? {
              currentRoom: {
                ...state.currentRoom,
                status:        'reading',
                currentPage:   data.currentPage   ?? state.currentRoom.currentPage,
                scrollPosition: data.scrollPosition ?? state.currentRoom.scrollPosition,
              },
            }
          : state
        ),

      /** Role transfer — new activeControllerId + updated participants */
      applyRoleUpdate: ({ activeControllerId, participants }) =>
        set(state => state.currentRoom
          ? { currentRoom: { ...state.currentRoom, activeControllerId, participants } }
          : state
        ),

      leaveRoom: () => set({ currentRoom: null, savedRoomId: null }),

      clearSavedRoom: () => set({ savedRoomId: null }),
    }),
    {
      name:       'syncRead_room',
      partialize: (state) => ({ savedRoomId: state.savedRoomId }),
    }
  )
)
