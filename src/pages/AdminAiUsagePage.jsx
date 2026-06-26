import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'estheras97@gmail.com'

export default function AdminAiUsagePage() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  async function load() {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, display_name, ai_enabled')
      .eq('ai_enabled', true)
    if (profilesError) { setError(profilesError.message); return }

    const { data: logs, error: logsError } = await supabase
      .from('ai_log')
      .select('user_id, estimated_cost, created_at')
    if (logsError) { setError(logsError.message); return }

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const result = (profiles || []).map(p => {
      const userLogs = (logs || []).filter(l => l.user_id === p.id)
      const allTime = userLogs.reduce((sum, l) => sum + (l.estimated_cost || 0), 0)
      const thisMonth = userLogs
        .filter(l => new Date(l.created_at) >= monthStart)
        .reduce((sum, l) => sum + (l.estimated_cost || 0), 0)
      return { ...p, allTime, thisMonth, logs: userLogs }
    })
    setRows(result)
  }

  if (!user) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const filtered = (rows || []).map(r => {
    if (!fromDate && !toDate) return r
    const inRange = r.logs.filter(l => {
      const d = new Date(l.created_at)
      if (fromDate && d < new Date(fromDate)) return false
      if (toDate && d > new Date(`${toDate}T23:59:59`)) return false
      return true
    })
    return { ...r, rangeTotal: inRange.reduce((sum, l) => sum + (l.estimated_cost || 0), 0) }
  })

  const showRangeTotal = !!(fromDate || toDate)
  const grandTotal = showRangeTotal
    ? filtered.reduce((sum, r) => sum + (r.rangeTotal || 0), 0)
    : filtered.reduce((sum, r) => sum + r.allTime, 0)

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>AI usage — all users</h2>

      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>to</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
        {showRangeTotal && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFromDate(''); setToDate('') }}>Clear</button>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>Error: {error}</p>}

      <div className="card mb-4">
        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{showRangeTotal ? 'Total in range' : 'Total all-time'}</p>
        <p style={{ fontSize: 22, fontWeight: 600 }}>${grandTotal.toFixed(2)}</p>
      </div>

      {!rows ? (
        <p className="text-dim" style={{ padding: 20 }}>Loading…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>This month</th>
                <th>All-time</th>
                {showRangeTotal && <th>In range</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.display_name || r.email}</td>
                  <td className="mono">${r.thisMonth.toFixed(2)}</td>
                  <td className="mono">${r.allTime.toFixed(2)}</td>
                  {showRangeTotal && <td className="mono">${(r.rangeTotal || 0).toFixed(2)}</td>}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={showRangeTotal ? 4 : 3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No AI-enabled users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
