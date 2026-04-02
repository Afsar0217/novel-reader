import { useEffect } from 'react'
import { useUserStore } from '../../store/userStore'

export const AppLayout = ({ children }) => {
  const { user, preferences, initUser } = useUserStore()

  useEffect(() => {
    initUser()
    document.documentElement.setAttribute('data-theme', preferences.theme || 'light')
  }, [])

  return (
    <div
      className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)] transition-colors duration-200"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {children}
    </div>
  )
}
