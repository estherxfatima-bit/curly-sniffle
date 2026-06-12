import ArcRing from '../ui/ArcRing'
import { budgetColor } from '../../lib/financeUtils'

// Ring showing spent vs budget, colour-coded green/amber/red, with an "Over budget" badge.
export default function BudgetRing({ label, spent, budget, size = 90, onClick }) {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
  const color = budgetColor(pct)
  const over = budget > 0 && spent > budget

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        position: 'relative', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {over && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          color: 'var(--danger)', background: 'rgba(196,64,96,0.12)',
          borderRadius: 999, padding: '3px 8px',
        }}>
          Over budget
        </span>
      )}
      <ArcRing value={Math.min(spent, budget || spent || 1)} max={budget || spent || 1} size={size} color={color} label={`${pct}%`} sublabel={label} />
      <p className="mono" style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>
        {budget > 0 ? <>£{spent.toFixed(0)} of £{budget.toFixed(0)} spent</> : <>£{spent.toFixed(0)} spent · no budget set</>}
      </p>
    </div>
  )
}
