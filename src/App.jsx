import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppLayout } from './components/Layout/AppLayout'
import { HomeView } from './views/HomeView'
import { ReaderView } from './views/ReaderView'
import { BookRequestPrompt } from './features/rooms/BookRequestPrompt'
import { useUserStore } from './store/userStore'
import { useRoomStore } from './store/roomStore'
import { syncService } from './services/syncService'
import { storePDF } from './services/storageService'
import { generateBookId } from './utils/idGenerator'
import { useReaderStore } from './store/readerStore'

const VIEWS = { HOME: 'home', READER: 'reader' }

export default function App() {
  const [view, setView] = useState(VIEWS.HOME)
  const [activePDFBuffer, setActivePDFBuffer] = useState(null)
  const [activeBookId, setActiveBookId] = useState(null)
  const [openRoomPanelOnEnter, setOpenRoomPanelOnEnter] = useState(false)

  const { user, preferences, initUser } = useUserStore()
  const { currentRoom, leaveRoom, requestedBook, clearRequestedBook } = useRoomStore()
  const { addBook, openBook } = useReaderStore()

  useEffect(() => {
    initUser()
    if (preferences?.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme)
    }
  }, [])

  // Re-init sync whenever the active room changes
  useEffect(() => {
    if (currentRoom && user) {
      syncService.destroy()
      syncService.init(currentRoom.roomId, user.clientId)
    }
  }, [currentRoom?.roomId, user?.clientId])

  const handleOpenBook = useCallback((bookId, buffer, openRoomPanel = false) => {
    setActiveBookId(bookId)
    setActivePDFBuffer(buffer)
    setOpenRoomPanelOnEnter(openRoomPanel)
    setView(VIEWS.READER)
  }, [])

  const handleBack = useCallback(() => {
    setView(VIEWS.HOME)
    setActivePDFBuffer(null)
    setActiveBookId(null)
    setOpenRoomPanelOnEnter(false)
  }, [])

  // When user enters room from HomeView: stay on home so they can pick / upload a book.
  // If they are already reading something, switch to reader and open the room panel.
  const handleJoinRoom = useCallback(() => {
    if (view === VIEWS.READER) {
      // Signal to reader to open the room panel
      setOpenRoomPanelOnEnter(true)
    }
    // If on home, the home view will show the "Room Active" banner — nothing extra needed
  }, [view])

  const handleLeaveRoom = useCallback(() => {
    syncService.send('user_leave', {})
    syncService.destroy()
    leaveRoom()
  }, [leaveRoom])

  /**
   * Called when the visitor taps "Upload" in the BookRequestPrompt.
   * We generate the same deterministic bookId and open the reader immediately,
   * which will sync page/scroll with the owner via existing PAGE_CHANGE events.
   */
  const handlePromptUpload = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) return

    try {
      const bookId = generateBookId(file.name, file.size)
      const arrayBuffer = await file.arrayBuffer()
      await storePDF(bookId, arrayBuffer.slice(0))

      const book = {
        id: bookId,
        title: file.name.replace(/\.pdf$/i, ''),
        filename: file.name,
        size: file.size,
        addedAt: Date.now(),
      }
      addBook(book)
      openBook(bookId)
      clearRequestedBook()
      // Open reader — room panel stays as-is since we're already in a room
      handleOpenBook(bookId, arrayBuffer, true)
    } catch (e) {
      console.error('Failed to load PDF from prompt:', e)
    }
  }, [addBook, openBook, clearRequestedBook, handleOpenBook])

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        {view === VIEWS.HOME && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <HomeView
              onOpenBook={handleOpenBook}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
            />
          </motion.div>
        )}

        {view === VIEWS.READER && (
          <motion.div
            key="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-screen"
          >
            <ReaderView
              bookId={activeBookId}
              pdfBuffer={activePDFBuffer}
              onBack={handleBack}
              initialRoomPanelOpen={openRoomPanelOnEnter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global book-request prompt — visible on top of any view when visitor
          receives a BOOK_SET event from the room owner */}
      <BookRequestPrompt onFileSelected={handlePromptUpload} />
    </AppLayout>
  )
}
