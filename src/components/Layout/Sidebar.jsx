import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookMarked, BarChart2, X, ChevronLeft } from 'lucide-react'
import { HighlightPanel } from '../../features/annotations/HighlightPanel'
import { AnalyticsPanel } from '../../features/reader/AnalyticsPanel'
import { IconButton } from '../UI/Button'

const TABS = [
  { id: 'highlights', icon: <BookMarked size={16} />, label: 'Highlights' },
  { id: 'analytics', icon: <BarChart2 size={16} />,  label: 'Analytics' },
]

export const ReaderSidebar = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('highlights')

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 288 }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="flex-shrink-0 border-l border-[var(--border)] bg-[var(--surface-0)] overflow-hidden flex flex-col h-full"
        >
          <div className="flex items-center border-b border-[var(--border)] px-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div className="ml-auto">
              <IconButton onClick={onClose} variant="ghost">
                <ChevronLeft size={16} />
              </IconButton>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'highlights' && (
                <motion.div
                  key="highlights"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <HighlightPanel open={true} />
                </motion.div>
              )}
              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-y-auto h-full"
                >
                  <AnalyticsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
