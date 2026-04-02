import { useState, useEffect, useRef, useCallback } from 'react'
import { useReaderStore } from '../store/readerStore'

const AVG_WPM = 238

export const useReadingAnalytics = (totalWordCount = 0) => {
  const { currentPage, totalPages } = useReaderStore()
  const [wpm, setWpm] = useState(AVG_WPM)
  const [sessionWords, setSessionWords] = useState(0)
  const sessionStartRef = useRef(Date.now())
  const lastPageRef = useRef(currentPage)
  const wordsPerPage = useRef([])
  const isActiveRef = useRef(true)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    const handleActivity = () => { lastActivityRef.current = Date.now() }
    document.addEventListener('mousemove', handleActivity, { passive: true })
    document.addEventListener('keydown', handleActivity, { passive: true })
    document.addEventListener('scroll', handleActivity, { passive: true, capture: true })

    return () => {
      document.removeEventListener('mousemove', handleActivity)
      document.removeEventListener('keydown', handleActivity)
      document.removeEventListener('scroll', handleActivity, true)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current > 30000
      isActiveRef.current = !idle

      if (!idle) {
        const elapsed = (Date.now() - sessionStartRef.current) / 60000
        if (elapsed > 0.1 && sessionWords > 10) {
          const calculatedWpm = Math.round(sessionWords / elapsed)
          if (calculatedWpm > 50 && calculatedWpm < 1000) {
            setWpm(prev => Math.round(prev * 0.7 + calculatedWpm * 0.3))
          }
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionWords])

  useEffect(() => {
    if (currentPage !== lastPageRef.current) {
      const pagesRead = Math.abs(currentPage - lastPageRef.current)
      const wordsOnPages = pagesRead * (totalWordCount / Math.max(totalPages, 1))
      setSessionWords(prev => prev + wordsOnPages)
      lastPageRef.current = currentPage
    }
  }, [currentPage, totalWordCount, totalPages])

  const resetSession = useCallback(() => {
    sessionStartRef.current = Date.now()
    setSessionWords(0)
    lastPageRef.current = currentPage
  }, [currentPage])

  const pagesLeft = Math.max(0, totalPages - currentPage - 1)
  const wordsLeft = pagesLeft * (totalWordCount / Math.max(totalPages, 1))
  const minutesLeft = wordsLeft / wpm
  const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0

  const formatTimeLeft = () => {
    if (minutesLeft < 1) return '< 1 min'
    if (minutesLeft < 60) return `${Math.round(minutesLeft)} min`
    const h = Math.floor(minutesLeft / 60)
    const m = Math.round(minutesLeft % 60)
    return `${h}h ${m}m`
  }

  return {
    wpm,
    sessionWords: Math.round(sessionWords),
    timeLeft: formatTimeLeft(),
    minutesLeft: Math.round(minutesLeft),
    progressPercent,
    pagesLeft,
    resetSession,
  }
}
