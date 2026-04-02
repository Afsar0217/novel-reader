import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'syncRead_annotations'

export const useAnnotationStore = create(
  persist(
    (set, get) => ({
      highlights: {},
      comments: {},
      selectedText: null,
      toolbarPosition: null,
      activeHighlightId: null,

      addHighlight: (bookId, highlight) => {
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: [
              ...(state.highlights[bookId] || []),
              { ...highlight, createdAt: Date.now() },
            ],
          },
        }))
      },

      removeHighlight: (bookId, highlightId) => {
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: (state.highlights[bookId] || []).filter(h => h.id !== highlightId),
          },
        }))
      },

      updateHighlightColor: (bookId, highlightId, color) => {
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: (state.highlights[bookId] || []).map(h =>
              h.id === highlightId ? { ...h, color } : h
            ),
          },
        }))
      },

      getHighlightsForPage: (bookId, pageIndex) => {
        return (get().highlights[bookId] || []).filter(h => h.pageIndex === pageIndex)
      },

      getHighlightsForBook: (bookId) => {
        return get().highlights[bookId] || []
      },

      addComment: (highlightId, comment) => {
        set(state => ({
          comments: {
            ...state.comments,
            [highlightId]: [
              ...(state.comments[highlightId] || []),
              { ...comment, createdAt: Date.now() },
            ],
          },
        }))
      },

      getCommentsForHighlight: (highlightId) => {
        return get().comments[highlightId] || []
      },

      setSelectedText: (selection) => {
        set({ selectedText: selection })
      },

      setToolbarPosition: (position) => {
        set({ toolbarPosition: position })
      },

      clearSelection: () => {
        set({ selectedText: null, toolbarPosition: null })
      },

      setActiveHighlight: (id) => {
        set({ activeHighlightId: id })
      },

      exportHighlights: (bookId) => {
        const highlights = get().highlights[bookId] || []
        const comments = get().comments
        return {
          bookId,
          exportedAt: new Date().toISOString(),
          highlights: highlights.map(h => ({
            ...h,
            comments: comments[h.id] || [],
          })),
        }
      },

      importHighlights: (bookId, data) => {
        if (!data?.highlights) return
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: [
              ...(state.highlights[bookId] || []),
              ...data.highlights.map(h => ({ ...h, imported: true })),
            ],
          },
        }))
      },

      mergeRemoteHighlights: (bookId, remoteHighlights) => {
        set(state => {
          const local = state.highlights[bookId] || []
          const localMap = new Map(local.map(h => [h.id, h]))
          remoteHighlights.forEach(h => {
            if (!localMap.has(h.id)) localMap.set(h.id, h)
          })
          return {
            highlights: {
              ...state.highlights,
              [bookId]: Array.from(localMap.values()),
            },
          }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        highlights: state.highlights,
        comments: state.comments,
      }),
    }
  )
)
