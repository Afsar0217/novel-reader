import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Search, Sliders, BookMarked,
  Users, Hash, WifiOff, X, Sun, Sunset, Moon,
  MessageCircle, Bookmark, BookmarkCheck,
  AlignJustify, BookOpen, MoreHorizontal, ZoomIn, ZoomOut,
} from 'lucide-react'
import { useReaderStore } from '../../store/readerStore'
import { useUserStore } from '../../store/userStore'
import { useRoomStore } from '../../store/roomStore'
import { IconButton } from '../../components/UI/Button'
import { Tooltip } from '../../components/UI/Tooltip'
import { Slider, Toggle } from '../../components/UI/Slider'

const THEMES = [
  { id: 'light', icon: <Sun size={14} />,    label: 'Light' },
  { id: 'sepia', icon: <Sunset size={14} />, label: 'Sepia' },
  { id: 'dark',  icon: <Moon size={14} />,   label: 'Dark'  },
]

/* ── Mobile menu button row item ── */
const MobileMenuBtn = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
  >
    <span className="flex-shrink-0 text-[var(--text-muted)]">{icon}</span>
    {label}
  </button>
)

/* ── Sync pill that lives inside the top bar ── */
const SyncPill = ({ onClick, syncLocked, onlineCount }) => (
  <button
    onClick={onClick}
    title={syncLocked ? 'Sync locked — click for free mode' : 'Free mode — click to lock'}
    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all border ${
      syncLocked
        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
        : 'bg-amber-500/10  border-amber-500/25  text-amber-600  dark:text-amber-400'
    }`}
  >
    {syncLocked
      ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /><span className="hidden sm:inline">Synced</span></>
      : <><WifiOff size={10} /><span className="hidden sm:inline">Free</span></>
    }
    {onlineCount > 1 && <span className="opacity-60">·{onlineCount}</span>}
  </button>
)

/* ════════════════════════════════════════════
   TOP BAR
════════════════════════════════════════════ */
export const ReaderTopBar = ({
  onBack, onOpenSearch, onToggleSidebar, onToggleRoomPanel,
  onToggleRoomChat, onToggleBookmarks, onToggleRoomManager,
  inRoom, title, sidebarOpen, roomPanelOpen, roomChatOpen, bookmarksOpen, unreadChat,
}) => {
  const { currentPage, totalPages, setCurrentPage } = useReaderStore()
  const { preferences, setTheme, toggleRuler, toggleFocusBlur, toggleAmbient, toggleSyncLocked, updatePreference, zoomIn, zoomOut, resetZoom } = useUserStore()
  const { currentRoom } = useRoomStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [pageInput, setPageInput] = useState('')

  const handlePageJump = (e) => {
    if (e.key === 'Enter') {
      const p = parseInt(pageInput, 10) - 1
      if (!isNaN(p)) setCurrentPage(Math.max(0, Math.min(p, totalPages - 1)))
      setPageInput('')
    }
  }

  const onlineCount = currentRoom?.participants?.filter(u => u.isOnline).length ?? 0

  return (
    <>
      <header className="flex items-center gap-1 px-2 sm:px-3 h-12 border-b border-[var(--border)] bg-[var(--surface-0)] flex-shrink-0 z-30 select-none">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all group flex-shrink-0"
          title="Back to lobby"
        >
          <ChevronLeft size={17} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline text-xs">Back</span>
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0 px-1">
          <p className="text-xs sm:text-sm font-medium truncate text-[var(--text-primary)]" title={title}>
            {title || 'Untitled'}
          </p>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">

          {/* ── Desktop-only items ── */}
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1">
            {/* Sync pill (only when in room) */}
            {inRoom && (
              <SyncPill
                syncLocked={preferences.syncLocked}
                onlineCount={onlineCount}
                onClick={toggleSyncLocked}
              />
            )}

            {/* Page jump */}
            <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] border border-[var(--border)]">
              <Hash size={10} />
              <input
                type="number"
                placeholder={String(currentPage + 1)}
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onKeyDown={handlePageJump}
                className="w-9 bg-transparent outline-none text-center text-xs"
                min={1} max={totalPages}
              />
              <span className="text-[var(--text-muted)] text-xs">/ {totalPages}</span>
            </div>

            <Tooltip content="Search (/)">
              <IconButton onClick={onOpenSearch} variant="ghost">
                <Search size={15} />
              </IconButton>
            </Tooltip>

            <Tooltip content="Bookmarks">
              <BookmarkTopBtn onClick={onToggleBookmarks} active={bookmarksOpen} />
            </Tooltip>

            <Tooltip content="Highlights">
              <IconButton onClick={onToggleSidebar} variant={sidebarOpen ? 'secondary' : 'ghost'}>
                <BookMarked size={15} />
              </IconButton>
            </Tooltip>
          </div>

          {/* ── Always visible ── */}

          {/* Zoom controls — always visible */}
          <ZoomControls
            zoomLevel={preferences.zoomLevel || 1}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
          />

          {/* View mode toggle — always visible */}
          <ViewModeToggle />

          <Tooltip content="Settings">
            <IconButton onClick={() => { setShowSettings(s => !s); setShowMoreMenu(false) }} variant={showSettings ? 'secondary' : 'ghost'}>
              <Sliders size={15} />
            </IconButton>
          </Tooltip>

          {/* Room chat button — visible on mobile too when in room */}
          {inRoom && (
            <Tooltip content="Room Chat">
              <div className="relative">
                <IconButton onClick={onToggleRoomChat} variant={roomChatOpen ? 'secondary' : 'ghost'}>
                  <MessageCircle size={15} />
                </IconButton>
                {!!unreadChat && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center pointer-events-none">
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
              </div>
            </Tooltip>
          )}

          {/* Room button */}
          <Tooltip content={inRoom ? 'Room panel' : 'Join a room'}>
            <button
              onClick={inRoom ? onToggleRoomPanel : onToggleRoomManager}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium transition-all ${
                inRoom
                  ? roomPanelOpen
                    ? 'bg-accent text-white'
                    : 'bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {inRoom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
              <Users size={14} />
              {inRoom && (
                <span className="hidden sm:inline font-semibold">{onlineCount}</span>
              )}
            </button>
          </Tooltip>

          {/* Mobile-only "More" button — opens dropdown with search/bookmarks/highlights */}
          <div className="relative sm:hidden">
            <IconButton
              onClick={() => { setShowMoreMenu(s => !s); setShowSettings(false) }}
              variant={showMoreMenu ? 'secondary' : 'ghost'}
            >
              <MoreHorizontal size={15} />
            </IconButton>

            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.13 }}
                    className="absolute right-0 z-40 bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-2 w-44 space-y-0.5"
                    style={{ top: '2.6rem' }}
                  >
                    <MobileMenuBtn icon={<Search size={14} />} label="Search" onClick={() => { onOpenSearch(); setShowMoreMenu(false) }} />
                    <MobileMenuBtn icon={<Bookmark size={14} />} label="Bookmarks" onClick={() => { onToggleBookmarks(); setShowMoreMenu(false) }} />
                    <MobileMenuBtn icon={<BookMarked size={14} />} label="Highlights" onClick={() => { onToggleSidebar(); setShowMoreMenu(false) }} />
                    <div className="flex items-center gap-1 px-3 py-1.5">
                      <span className="text-xs text-[var(--text-muted)] flex-1">Zoom</span>
                      <button onClick={zoomOut} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-30" disabled={(preferences.zoomLevel || 1) <= 0.5}>
                        <ZoomOut size={13} />
                      </button>
                      <button onClick={resetZoom} className="min-w-[3rem] text-center text-xs font-mono font-semibold text-[var(--text-primary)] hover:text-accent transition-colors">
                        {Math.round((preferences.zoomLevel || 1) * 100)}%
                      </button>
                      <button onClick={zoomIn} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-30" disabled={(preferences.zoomLevel || 1) >= 3}>
                        <ZoomIn size={13} />
                      </button>
                    </div>
                    {inRoom && (
                      <MobileMenuBtn
                        icon={<WifiOff size={14} />}
                        label={preferences.syncLocked ? 'Free mode' : 'Lock sync'}
                        onClick={() => { toggleSyncLocked(); setShowMoreMenu(false) }}
                      />
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>
      </header>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{   opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-2 sm:right-4 z-40 bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] p-4 w-[min(288px,calc(100vw-16px))] space-y-4"
              style={{ top: '3.25rem' }}
            >
              {/* Close */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Reading Settings</p>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
                  <X size={14} />
                </button>
              </div>

              {/* Theme */}
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2">Theme</p>
                <div className="flex gap-2">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        preferences.theme === t.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <SettingsSliders />

              {/* Toggles */}
              <div className="space-y-2.5 border-t border-[var(--border)] pt-3">
                <Toggle checked={preferences.rulerEnabled}   onChange={toggleRuler}     label="📏 Reading Ruler" />
                <Toggle checked={preferences.focusBlur}      onChange={toggleFocusBlur} label="🎯 Focus Blur" />
                <Toggle checked={preferences.ambientEnabled} onChange={toggleAmbient}   label="🌧 Ambient Sound" />
              </div>

              {inRoom && (
                <div className="border-t border-[var(--border)] pt-3">
                  <Toggle
                    checked={preferences.syncLocked}
                    onChange={toggleSyncLocked}
                    label={preferences.syncLocked ? '🔒 Sync Locked' : '🔓 Free Mode'}
                  />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

const ZoomControls = ({ zoomLevel, onZoomIn, onZoomOut, onReset }) => (
  <div className="flex items-center bg-[var(--surface-2)] rounded-xl p-0.5 border border-[var(--border)] gap-0.5">
    <Tooltip content="Zoom out">
      <button
        onClick={onZoomOut}
        disabled={zoomLevel <= 0.5}
        className="flex items-center justify-center w-6 h-6 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-0)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ZoomOut size={11} />
      </button>
    </Tooltip>

    <Tooltip content="Reset zoom (100%)">
      <button
        onClick={onReset}
        className="min-w-[2.6rem] h-6 px-1 rounded-lg text-[10px] font-mono font-semibold text-[var(--text-primary)] hover:text-accent hover:bg-[var(--surface-0)] transition-all tabular-nums"
      >
        {Math.round(zoomLevel * 100)}%
      </button>
    </Tooltip>

    <Tooltip content="Zoom in">
      <button
        onClick={onZoomIn}
        disabled={zoomLevel >= 3}
        className="flex items-center justify-center w-6 h-6 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-0)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ZoomIn size={11} />
      </button>
    </Tooltip>
  </div>
)

const ViewModeToggle = () => {
  const { preferences, updatePreference } = useUserStore()
  const mode = preferences.readingMode || 'scroll'
  return (
    <div className="flex items-center bg-[var(--surface-2)] rounded-xl p-0.5 border border-[var(--border)]">
      <Tooltip content="Scroll view">
        <button
          onClick={() => updatePreference('readingMode', 'scroll')}
          className={`flex items-center justify-center w-7 h-6 rounded-lg transition-all ${
            mode === 'scroll'
              ? 'bg-[var(--surface-0)] shadow-sm text-accent'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <AlignJustify size={12} />
        </button>
      </Tooltip>
      <Tooltip content="Book view — two pages">
        <button
          onClick={() => updatePreference('readingMode', 'book')}
          className={`flex items-center justify-center w-7 h-6 rounded-lg transition-all ${
            mode === 'book'
              ? 'bg-[var(--surface-0)] shadow-sm text-accent'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <BookOpen size={12} />
        </button>
      </Tooltip>
    </div>
  )
}

const BookmarkTopBtn = ({ onClick, active }) => {
  const { currentPage, isPageBookmarked } = useReaderStore()
  const bookmarked = isPageBookmarked(currentPage)
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-xl transition-all ${
        active || bookmarked
          ? 'text-accent bg-accent/10 hover:bg-accent/20'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
    </button>
  )
}

const SettingsSliders = () => {
  const { updatePreference, preferences } = useUserStore()
  return (
    <div className="space-y-3">
      <Slider label="Font Scale"  value={preferences.fontSize||16}  min={12} max={28} step={1}   unit="px" onChange={v => updatePreference('fontSize', v)} />
      <Slider label="Line Height" value={preferences.lineHeight||1.7} min={1.2} max={2.4} step={0.1}        onChange={v => updatePreference('lineHeight', v)} />
    </div>
  )
}

/* ════════════════════════════════════════════
   BOTTOM BAR
════════════════════════════════════════════ */
export const ReaderBottomBar = ({
  onPrevPage, onNextPage, onOpenRoomManager, onOpenChat,
  onToggleBookmark, inRoom, unreadChat,
}) => {
  const { currentPage, totalPages, isPageBookmarked } = useReaderStore()
  const { currentRoom } = useRoomStore()
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0
  const onlineCount = currentRoom?.participants?.filter(u => u.isOnline).length ?? 0
  const bookmarked = isPageBookmarked(currentPage)

  return (
    <div className="flex items-center gap-1 px-2 h-12 sm:h-11 border-t border-[var(--border)] bg-[var(--surface-0)] flex-shrink-0 safe-bottom select-none">
      {/* Prev */}
      <Tooltip content="Previous page (swipe right on mobile)">
        <IconButton onClick={onPrevPage} disabled={currentPage === 0} variant="ghost">
          <ChevronLeft size={18} />
        </IconButton>
      </Tooltip>

      {/* Progress bar + page */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div
          className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden cursor-pointer"
          title={`${Math.round(progress)}% complete`}
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)] font-medium tabular-nums whitespace-nowrap">
          {currentPage + 1}<span className="text-[var(--surface-3)]">/</span>{totalPages}
        </span>
      </div>

      {/* Bookmark quick toggle */}
      <Tooltip content={bookmarked ? 'Remove bookmark' : 'Bookmark page'}>
        <button
          onClick={onToggleBookmark}
          className={`p-1.5 rounded-xl transition-all ${
            bookmarked ? 'text-accent' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
          }`}
        >
          {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </Tooltip>

      {/* Room chat (only in room) */}
      {inRoom && (
        <Tooltip content="Room Chat">
          <div className="relative">
            <button
              onClick={onOpenChat}
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <MessageCircle size={15} />
            </button>
            {!!unreadChat && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center pointer-events-none">
                {unreadChat > 9 ? '9+' : unreadChat}
              </span>
            )}
          </div>
        </Tooltip>
      )}

      {/* Room indicator / join */}
      {inRoom ? (
        <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium flex-shrink-0 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="hidden sm:inline">{onlineCount}</span>
        </div>
      ) : (
        <Tooltip content="Start a reading room">
          <button
            onClick={onOpenRoomManager}
            className="flex items-center gap-1 p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Users size={15} />
          </button>
        </Tooltip>
      )}

      {/* Next */}
      <Tooltip content="Next page (swipe left on mobile)">
        <IconButton onClick={onNextPage} disabled={currentPage >= totalPages - 1} variant="ghost">
          <ChevronRight size={18} />
        </IconButton>
      </Tooltip>
    </div>
  )
}
