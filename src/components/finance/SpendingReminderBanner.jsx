import { X, AlertCircle } from 'lucide-react'

// Dismissible banner: "Haven't logged any spending in X days — keep it up to date."
export default function SpendingReminderBanner({ days, onDismiss }) {
  return (
    <div className="card scale-in" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: '1px solid var(--warning)', background: 'rgba(200,130,10,0.08)',
      marginBottom: 16, padding: '12px 16px',
    }}>
      <div className="flex items-center gap-3">
        <AlertCircle size={16} color="var(--warning)" />
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Haven't logged any spending in {days === 'a while' ? 'a while' : `${days} days`} — keep it up to date.
        </p>
      </div>
      <button className="btn-icon btn" onClick={onDismiss} title="Dismiss">
        <X size={13} />
      </button>
    </div>
  )
}
