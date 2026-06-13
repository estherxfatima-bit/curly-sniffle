import { useEffect } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { Timer, Square, Coffee } from 'lucide-react'

function formatClock(seconds) {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ActiveTimerBar({ isMobile }) {
  const ctx = useTimer()
  const { timer, elapsedSeconds, remainingSeconds, stopTimer, advancePomodoroPhase } = ctx || {}

  // Auto-advance pomodoro phases when the current phase runs out
  useEffect(() => {
    if (timer?.mode === 'pomodoro' && remainingSeconds === 0) {
      advancePomodoroPhase()
    }
  }, [timer, remainingSeconds, advancePomodoroPhase])

  if (!ctx || !timer) return null

  let display, label
  if (timer.mode === 'stopwatch') {
    display = formatClock(elapsedSeconds)
    label = timer.todoText
  } else if (timer.mode === 'countdown') {
    display = formatClock(remainingSeconds)
    label = timer.todoText
  } else {
    display = formatClock(remainingSeconds)
    label = `${timer.phase === 'focus' ? 'Focus' : 'Break'} · ${timer.todoText}`
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 76 : 28,
      left: isMobile ? 12 : 24,
      right: isMobile ? 12 : 'auto',
      zIndex: 190,
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      maxWidth: isMobile ? 'none' : 320,
    }}>
      {timer.mode === 'pomodoro' && timer.phase === 'break'
        ? <Coffee size={14} color="var(--wellness)" />
        : <Timer size={14} color="var(--career)" />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{display}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
      </div>
      <button className="btn-icon" style={{ flexShrink: 0, color: 'var(--danger)' }} onClick={() => stopTimer()} title="Stop and log time">
        <Square size={14} />
      </button>
    </div>
  )
}
