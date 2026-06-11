import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function QuarterlyWins({ quarter }) {
  const { user } = useAuth()
  const [wins, setWins] = useState([])
  const [allQuarters, setAllQuarters] = useState([])
  const [viewQuarter, setViewQuarter] = useState(quarter)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setViewQuarter(quarter) }, [quarter])
  useEffect(() => { if (user) loadAllQuarters() }, [user])
  useEffect(() => { if (user) loadWins() }, [user, viewQuarter])

  async function loadAllQuarters() {
    const { data } = await supabase.from('quarterly_wins').select('quarter').eq('user_id', user.id)
    const set = new Set((data || []).map(r => r.quarter))
    set.add(quarter)
    setAllQuarters([...set].sort().reverse())
  }

  async function loadWins() {
    setLoading(true)
    const { data } = await supabase.from('quarterly_wins').select('*').eq('user_id', user.id).eq('quarter', viewQuarter).order('created_at', { ascending: false })
    setWins(data || [])
    setLoading(false)
  }

  async function addWin() {
    const text = input.trim()
    if (!text) return
    const { data } = await supabase.from('quarterly_wins').insert({ user_id: user.id, quarter: viewQuarter, text }).select().single()
    if (data) {
      setWins(prev => [data, ...prev])
      if (!allQuarters.includes(viewQuarter)) setAllQuarters(prev => [...prev, viewQuarter].sort().reverse())
    }
    setInput('')
  }

  async function removeWin(id) {
    await supabase.from('quarterly_wins').delete().eq('id', id)
    setWins(prev => prev.filter(w => w.id !== id))
  }

  return (
    <div className="card card-finance">
      <div className="flex items-center justify-between mb-4">
        <h3>Quarterly wins</h3>
        {allQuarters.length > 1 && (
          <select value={viewQuarter} onChange={e => setViewQuarter(e.target.value)} style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}>
            {allQuarters.map(q => <option key={q}>{q}</option>)}
          </select>
        )}
      </div>

      {viewQuarter === quarter && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addWin()}
            placeholder="Log a win…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button className="btn btn-sm btn-ghost" onClick={addWin}><Plus size={12} /></button>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
      ) : wins.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No wins logged for {viewQuarter} yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wins.map(w => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', borderLeft: '2px solid var(--finance)' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13 }}>{w.text}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{format(new Date(w.created_at), 'MMM d, yyyy')}</p>
              </div>
              <button className="btn-icon" style={{ padding: 2 }} onClick={() => removeWin(w.id)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
