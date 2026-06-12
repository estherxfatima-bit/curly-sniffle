import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERIOD_VIEWS, shiftRefDate, getPeriodLabel, isCurrentPeriod } from '../../lib/periodNav'

// Daily / Weekly / Monthly view switcher + period navigation — same pattern as the Dashboard.
export default function PeriodNav({ activeView, onViewChange, refDate, onRefDateChange, accentColor = 'var(--career)' }) {
  const periodLabel = getPeriodLabel(refDate, activeView)
  const current = isCurrentPeriod(refDate, activeView)

  return (
    <div className="flex items-center justify-between gap-3 wrap" style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
        {PERIOD_VIEWS.map(v => {
          const active = activeView === v.id
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              style={{
                padding: '7px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--card-bg)' : 'transparent',
                color: active ? accentColor : 'var(--text-3)',
                border: active ? '1px solid var(--border)' : 'none',
                boxShadow: active ? 'var(--shadow)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 wrap">
        <button className="btn-icon btn" onClick={() => onRefDateChange(d => shiftRefDate(d, activeView, -1))} title="Previous">
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', minWidth: 150, textAlign: 'center' }}>
          {periodLabel}
        </span>
        <button className="btn-icon btn" onClick={() => onRefDateChange(d => shiftRefDate(d, activeView, 1))} title="Next">
          <ChevronRight size={15} />
        </button>
        {!current && (
          <button className="btn btn-xs btn-ghost" onClick={() => onRefDateChange(new Date())}>Today</button>
        )}
      </div>
    </div>
  )
}
