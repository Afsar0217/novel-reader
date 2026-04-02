import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'syncRead_books'

export const useReaderStore = create(
  persist(
    (set, get) => ({
      books: {},
      currentBookId: null,
      currentPage: 0,
      scrollPosition: 0,
      totalPages: 0,
      pdfDocument: null,
      isLoading: false,
      loadError: null,
      readingProgress: {},
      /** { [bookId]: Bookmark[] } — persisted */
      bookmarks: {},

      addBook: (book) => {
        set(state => ({
          books: { ...state.books, [book.id]: book },
        }))
      },

      removeBook: (bookId) => {
        set(state => {
          const books = { ...state.books }
          delete books[bookId]
          return { books }
        })
      },

      openBook: (bookId) => {
        const book = get().books[bookId]
        if (!book) return
        const progress = get().readingProgress[bookId] || {}
        set({
          currentBookId: bookId,
          currentPage: progress.page || 0,
          scrollPosition: progress.scrollPosition || 0,
          loadError: null,
          pdfDocument: null,
          isLoading: true,
          totalPages: 0,
        })
      },

      closeBook: () => {
        set({
          currentBookId: null,
          currentPage: 0,
          scrollPosition: 0,
          pdfDocument: null,
        })
      },

      setPdfDocument: (doc) => {
        set({ pdfDocument: doc, totalPages: doc?.numPages || 0, isLoading: false })
      },

      setLoading: (isLoading) => set({ isLoading }),
      setLoadError: (error) => set({ loadError: error, isLoading: false }),

      setCurrentPage: (page) => {
        const { currentBookId, totalPages } = get()
        const safePage = Math.max(0, Math.min(page, totalPages - 1))
        set({ currentPage: safePage })
        if (currentBookId) {
          set(state => ({
            readingProgress: {
              ...state.readingProgress,
              [currentBookId]: {
                ...(state.readingProgress[currentBookId] || {}),
                page: safePage,
                lastRead: Date.now(),
              },
            },
          }))
        }
      },

      setScrollPosition: (scrollPosition) => {
        const { currentBookId } = get()
        set({ scrollPosition })
        if (currentBookId) {
          set(state => ({
            readingProgress: {
              ...state.readingProgress,
              [currentBookId]: {
                ...(state.readingProgress[currentBookId] || {}),
                scrollPosition,
                lastRead: Date.now(),
              },
            },
          }))
        }
      },

      setTotalPages: (totalPages) => set({ totalPages }),

      getCurrentBook: () => {
        const { books, currentBookId } = get()
        return currentBookId ? books[currentBookId] : null
      },

      getReadingProgress: (bookId) => {
        return get().readingProgress[bookId] || null
      },

      updateBookMetadata: (bookId, meta) => {
        set(state => ({
          books: {
            ...state.books,
            [bookId]: { ...state.books[bookId], ...meta },
          },
        }))
      },

      /* ── Bookmarks ── */
      addBookmark: (label = '') => {
        const { currentBookId, currentPage, bookmarks } = get()
        if (!currentBookId) return

        const existing = (bookmarks[currentBookId] || [])
        // Prevent duplicate bookmark for same page
        if (existing.some(b => b.page === currentPage)) return

        const bookmark = {
          id: `bm_${Date.now()}`,
          page: currentPage,
          label: label || `Page ${currentPage + 1}`,
          createdAt: Date.now(),
        }
        set(state => ({
          bookmarks: {
            ...state.bookmarks,
            [currentBookId]: [...(state.bookmarks[currentBookId] || []), bookmark]
              .sort((a, b) => a.page - b.page),
          },
        }))
        return bookmark
      },

      removeBookmark: (bookmarkId) => {
        const { currentBookId } = get()
        if (!currentBookId) return
        set(state => ({
          bookmarks: {
            ...state.bookmarks,
            [currentBookId]: (state.bookmarks[currentBookId] || []).filter(b => b.id !== bookmarkId),
          },
        }))
      },

      updateBookmarkLabel: (bookmarkId, label) => {
        const { currentBookId } = get()
        if (!currentBookId) return
        set(state => ({
          bookmarks: {
            ...state.bookmarks,
            [currentBookId]: (state.bookmarks[currentBookId] || []).map(b =>
              b.id === bookmarkId ? { ...b, label } : b
            ),
          },
        }))
      },

      getBookmarks: (bookId) => {
        const id = bookId || get().currentBookId
        return id ? (get().bookmarks[id] || []) : []
      },

      isPageBookmarked: (page) => {
        const { currentBookId, bookmarks } = get()
        if (!currentBookId) return false
        return (bookmarks[currentBookId] || []).some(b => b.page === page)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        books: Object.fromEntries(
          Object.entries(state.books).map(([id, book]) => [
            id,
            { ...book, arrayBuffer: undefined },
          ])
        ),
        readingProgress: state.readingProgress,
        bookmarks: state.bookmarks,
      }),
    }
  )
)
