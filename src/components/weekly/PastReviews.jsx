import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function PastReviews({ onClose }) {
  useLockBodyScroll()
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .then(({ data }) => { setReviews(data || []); setLoading(false) })
  }, [user])

  return createPortal(
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Past reviews</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <p className="text-dim" style={{ padding: '24px', textAlign: 'center' }}>Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="text-dim" style={{ padding: '24px', textAlign: 'center' }}>No past reviews yet.</p>
        ) : selected ? (
          <ReviewDetail review={selected} onBack={() => setSelected(null)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reviews.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                style={{
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  Week of {format(new Date(r.week_start), 'MMM d, yyyy')}
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Energy: {r.energy_level}/5</span>
                  <span style={{ fontSize: '12px', color: 'var(--cobalt)' }}>→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function ReviewDetail({ review, onBack }) {
  return (
    <div>
      <button className="btn btn-ghost btn-sm mb-3" onClick={onBack}>← Back</button>
      <p className="mono mb-4" style={{ color: 'var(--accent)' }}>Week of {format(new Date(review.week_start), 'MMMM d, yyyy')}</p>

      {[
        ['What shipped', review.shipped],
        ["What didn't ship", review.didnt_ship],
        ['One win', review.one_win],
        ['One thing to drop', review.one_to_drop],
      ].map(([label, val]) => val && (
        <div key={label} className="form-group">
          <label>{label}</label>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.6' }}>{val}</p>
        </div>
      ))}

      <div className="form-group">
        <label>Energy level</label>
        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{review.energy_level}/5</p>
      </div>

      {review.ai_summary && (
        <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '14px', marginTop: '8px', borderLeft: '3px solid var(--accent)' }}>
          <p className="mono mb-2" style={{ color: 'var(--accent)' }}>AI summary</p>
          <p style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-2)' }}>{review.ai_summary}</p>
        </div>
      )}
    </div>
  )
}
