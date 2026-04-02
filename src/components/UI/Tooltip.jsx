import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export const Tooltip = ({ children, content, side = 'top', delay = 400 }) => {
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  if (!content) return children

  const handleEnter = () => {
    timer.current = setTimeout(() => setVisible(true), delay)
  }

  const handleLeave = () => {
    clearTimeout(timer.current)
    setVisible(false)
  }

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            className={`absolute ${positions[side]} z-50 pointer-events-none`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
          >
            <div className="bg-[var(--text-primary)] text-[var(--surface-0)] text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const Badge = ({ children, color = 'default', className = '' }) => {
  const colors = {
    default: 'bg-[var(--surface-2)] text-[var(--text-secondary)]',
    accent: 'bg-accent/10 text-accent',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  )
}

export const Divider = ({ className = '' }) => (
  <div className={`h-px bg-[var(--border)] ${className}`} />
)

export const Spinner = ({ size = 20, className = '' }) => (
  <svg
    className={`animate-spin text-accent ${className}`}
    style={{ width: size, height: size }}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)
