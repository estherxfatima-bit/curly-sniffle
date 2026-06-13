import { useState } from 'react'
import { useTimer } from '../../hooks/useTimer'
import { X, Hourglass, Timer as TimerIcon, Coffee } from 'lucide-react'

export default function TimerWidget({ todo, onClose }) {
  const { timer, startTimer, stopTimer } = useTimer()
  const isRunningHere = timer?.todoId === todo.id
  const [mode, setMode] = useState(todo.duration_minutes ? 'countdown' : 'stopwatch')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)

  function handleStart() {
    startTimer(todo, mode, { focusMinutes, breakMinutes })
    onClose()
  }

  async function handleStop() {
    await stopTimer()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 320, padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.text}</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {isRunningHere ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>Timer is running for this task.</p>
            <button className="btn btn-career" style={{ color: '#fff' }} onClick={handleStop}>Stop &amp; log time</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              {timer ? 'Starting this will stop your other running timer.' : 'Choose a timer mode:'}
            </p>
            <div className="flex gap-2 mb-3">
              <button className={`btn btn-xs flex-1 ${mode === 'countdown' ? 'btn-career' : 'btn-ghost'}`} style={mode === 'countdown' ? { color: '#fff' } : {}} onClick={() => setMode('countdown')}>
                <Hourglass size={12} /> Countdown
              </button>
              <button className={`btn btn-xs flex-1 ${mode === 'stopwatch' ? 'btn-career' : 'btn-ghost'}`} style={mode === 'stopwatch' ? { color: '#fff' } : {}} onClick={() => setMode('stopwatch')}>
                <TimerIcon size={12} /> Stopwatch
              </button>
              <button className={`btn btn-xs flex-1 ${mode === 'pomodoro' ? 'btn-career' : 'btn-ghost'}`} style={mode === 'pomodoro' ? { color: '#fff' } : {}} onClick={() => setMode('pomodoro')}>
                <Coffee size={12} /> Pomodoro
              </button>
            </div>

            {mode === 'countdown' && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                {todo.duration_minutes
                  ? `Counts down from this task's duration (${todo.duration_minutes} min).`
                  : 'No duration set — defaults to 25 minutes.'}
              </p>
            )}

            {mode === 'pomodoro' && (
              <div className="flex items-center gap-3 mb-3">
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  Focus
                  <input type="number" min="1" value={focusMinutes} onChange={e => setFocusMinutes(Number(e.target.value) || 1)} style={{ width: 56, fontSize: 12, padding: '2px 6px' }} />
                  min
                </label>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  Break
                  <input type="number" min="1" value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value) || 1)} style={{ width: 56, fontSize: 12, padding: '2px 6px' }} />
                  min
                </label>
              </div>
            )}

            <button className="btn btn-career" style={{ color: '#fff', width: '100%' }} onClick={handleStart}>Start timer</button>
          </>
        )}

        {todo.time_spent_minutes > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            Logged so far: {todo.time_spent_minutes} min
          </p>
        )}
      </div>
    </div>
  )
}
