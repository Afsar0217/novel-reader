import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateClientId, generateUsername } from '../utils/idGenerator'
import { generateRandomAvatarColor } from '../utils/colorUtils'

const STORAGE_KEY = 'syncRead_user'

const createInitialUser = () => ({
  clientId: generateClientId(),
  username: generateUsername(),
  avatarColor: generateRandomAvatarColor(),
  createdAt: Date.now(),
})

export const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      preferences: {
        theme: 'light',
        fontSize: 16,
        lineHeight: 1.7,
        readingMode: 'scroll',
        zoomLevel: 1,
        rulerEnabled: false,
        focusBlur: false,
        ambientEnabled: false,
        syncLocked: true,
      },

      initUser: () => {
        const { user } = get()
        if (!user) {
          set({ user: createInitialUser() })
        }
      },

      updateUsername: (username) =>
        set(state => ({ user: { ...state.user, username } })),

      updatePreference: (key, value) =>
        set(state => ({
          preferences: { ...state.preferences, [key]: value },
        })),

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set(state => ({
          preferences: { ...state.preferences, theme },
        }))
      },

      toggleRuler: () =>
        set(state => ({
          preferences: { ...state.preferences, rulerEnabled: !state.preferences.rulerEnabled },
        })),

      toggleFocusBlur: () =>
        set(state => ({
          preferences: { ...state.preferences, focusBlur: !state.preferences.focusBlur },
        })),

      toggleAmbient: () =>
        set(state => ({
          preferences: { ...state.preferences, ambientEnabled: !state.preferences.ambientEnabled },
        })),

      toggleSyncLocked: () =>
        set(state => ({
          preferences: { ...state.preferences, syncLocked: !state.preferences.syncLocked },
        })),

      zoomIn: () =>
        set(state => ({
          preferences: {
            ...state.preferences,
            zoomLevel: Math.min(3, Math.round((state.preferences.zoomLevel || 1) * 10 + 2.5) / 10),
          },
        })),

      zoomOut: () =>
        set(state => ({
          preferences: {
            ...state.preferences,
            zoomLevel: Math.max(0.5, Math.round((state.preferences.zoomLevel || 1) * 10 - 2.5) / 10),
          },
        })),

      resetZoom: () =>
        set(state => ({
          preferences: { ...state.preferences, zoomLevel: 1 },
        })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ user: state.user, preferences: state.preferences }),
      onRehydrateStorage: () => (state) => {
        if (state?.preferences?.theme) {
          document.documentElement.setAttribute('data-theme', state.preferences.theme)
        }
      },
    }
  )
)
