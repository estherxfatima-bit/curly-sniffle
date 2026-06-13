import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TimerContext = createContext(null)

const STORAGE_KEY = 'lifeos-active-timer'
const DEFAULT_POMODORO = { focusMinutes: 25, breakMinutes: 5 }

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function TimerProvider({ children }) {
  const [timer, setTimer] = useState(() => loadStored())
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef(null)

  useEffect(() => {
    if (timer) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [timer])

  useEffect(() => {
    if (timer) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timer])

  // Start a timer for a todo.
  // mode: 'countdown' | 'stopwatch' | 'pomodoro'
  const startTimer = useCallback((todo, mode, opts = {}) => {
    const base = {
      todoId: todo.id,
      todoText: todo.text,
      mode,
      startedAt: Date.now(),
      existingTimeSpent: todo.time_spent_minutes || 0,
    }
    if (mode === 'countdown') {
      base.totalSeconds = (todo.duration_minutes || 25) * 60
    } else if (mode === 'pomodoro') {
      base.focusMinutes = opts.focusMinutes || DEFAULT_POMODORO.focusMinutes
      base.breakMinutes = opts.breakMinutes || DEFAULT_POMODORO.breakMinutes
      base.phase = 'focus'
      base.totalSeconds = base.focusMinutes * 60
    }
    setTimer(base)
    setNow(Date.now())
  }, [])

  // Logs elapsed time (minutes, rounded) to the todo's time_spent_minutes and clears the timer.
  const stopTimer = useCallback(async (elapsedSecondsOverride) => {
    if (!timer) return
    const elapsedSeconds = elapsedSecondsOverride ?? Math.floor((Date.now() - timer.startedAt) / 1000)
    const elapsedMinutes = Math.round(elapsedSeconds / 60)
    if (elapsedMinutes > 0) {
      const newTotal = (timer.existingTimeSpent || 0) + elapsedMinutes
      await supabase.from('daily_todos').update({ time_spent_minutes: newTotal }).eq('id', timer.todoId)
    }
    setTimer(null)
    return elapsedMinutes
  }, [timer])

  // Advances a pomodoro to its next phase (focus <-> break) without logging time yet.
  const advancePomodoroPhase = useCallback(() => {
    setTimer(prev => {
      if (!prev || prev.mode !== 'pomodoro') return prev
      const nextPhase = prev.phase === 'focus' ? 'break' : 'focus'
      const totalSeconds = (nextPhase === 'focus' ? prev.focusMinutes : prev.breakMinutes) * 60
      return { ...prev, phase: nextPhase, startedAt: Date.now(), totalSeconds }
    })
  }, [])

  const elapsedSeconds = timer ? Math.floor((now - timer.startedAt) / 1000) : 0
  const remainingSeconds = timer?.totalSeconds != null ? Math.max(timer.totalSeconds - elapsedSeconds, 0) : null

  return (
    <TimerContext.Provider value={{ timer, elapsedSeconds, remainingSeconds, startTimer, stopTimer, advancePomodoroPhase }}>
      {children}
    </TimerContext.Provider>
  )
}

export const useTimer = () => useContext(TimerContext)
