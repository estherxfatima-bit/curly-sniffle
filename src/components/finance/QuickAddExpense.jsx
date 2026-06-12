import { useState } from 'react'
import { Check } from 'lucide-react'
import { VARIABLE_CATS, CAT_COLORS, CAT_EMOJI } from '../../lib/financeUtils'

// Effortless expense logging: type an amount, tap a category pill, done.
// Optional note field can be expanded before picking a category.
export default function QuickAddExpense({ onAdd, compact }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function pick(category) {
    const value = parseFloat(amount)
    if (!value || value <= 0 || submitting) return
    setSubmitting(true)
    await onAdd({ amount: value, category, name: note || category })
    setAmount('')
    setNote('')
    setShowNote(false)
    setSubmitting(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 1200)
  }

  if (success) {
    return (
      <div className="scale-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: compact ? '10px 0' : '20px 0', color: 'var(--success)' }}>
        <Check size={18} strokeWidth={3} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Added!</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number"
          inputMode="decimal"
          placeholder="£ amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ fontSize: 14, flex: 1 }}
          autoFocus={!compact}
        />
        <button className="btn btn-sm btn-ghost" onClick={() => setShowNote(v => !v)}>
          {showNote ? 'Hide note' : 'Note'}
        </button>
      </div>
      {showNote && (
        <input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ fontSize: 12 }} />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {VARIABLE_CATS.map(cat => (
          <button
            key={cat}
            disabled={!amount || parseFloat(amount) <= 0 || submitting}
            onClick={() => pick(cat)}
            className="btn btn-sm"
            style={{
              background: CAT_COLORS[cat], color: '#fff',
              opacity: (!amount || parseFloat(amount) <= 0) ? 0.4 : 1,
              border: 'none',
            }}
          >
            {CAT_EMOJI[cat]} {cat}
          </button>
        ))}
      </div>
    </div>
  )
}
