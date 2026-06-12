// Daily / Weekly / Monthly toggle — reused on Finance and Insights pages.
export const PERIOD_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export default function PeriodToggle({ value, onChange, activeClass = 'btn-finance' }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PERIOD_OPTIONS.map(p => (
        <button
          key={p.id}
          className={`btn btn-sm ${value === p.id ? activeClass : 'btn-ghost'}`}
          style={value === p.id ? { color: '#fff' } : {}}
          onClick={() => onChange(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
