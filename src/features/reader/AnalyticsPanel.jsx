import { motion } from 'framer-motion'
import { BarChart2, Clock, Zap, BookOpen, Target } from 'lucide-react'
import { useReadingAnalytics } from '../../hooks/useReadingAnalytics'
import { useReaderStore } from '../../store/readerStore'

const StatCard = ({ icon, label, value, sub, color = 'accent' }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-3 bg-[var(--surface-1)] rounded-xl"
  >
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--accent-muted)' }}
    >
      <span className="text-accent">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  </motion.div>
)

export const AnalyticsPanel = () => {
  const { currentPage, totalPages } = useReaderStore()
  const { wpm, timeLeft, progressPercent, pagesLeft, sessionWords } = useReadingAnalytics()

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 size={15} className="text-accent" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Reading Analytics</h3>
      </div>

      <div className="space-y-2">
        <StatCard
          icon={<Zap size={16} />}
          label="Reading Speed"
          value={`${wpm} WPM`}
          sub="avg words per minute"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Time Remaining"
          value={timeLeft}
          sub={`${pagesLeft} pages left`}
        />
        <StatCard
          icon={<BookOpen size={16} />}
          label="Session Words"
          value={sessionWords.toLocaleString()}
          sub="read this session"
        />
        <StatCard
          icon={<Target size={16} />}
          label="Progress"
          value={`${Math.round(progressPercent)}%`}
          sub={`Page ${currentPage + 1} of ${totalPages}`}
        />
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
          <span>Overall Progress</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  )
}
