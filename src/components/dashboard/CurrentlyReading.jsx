import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function CurrentlyReading() {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('books').select('*').eq('user_id', user.id).eq('status', 'reading').order('started_at', { ascending: false })
      .then(({ data }) => { setBooks(data || []); setLoading(false) })
  }, [user])

  return (
    <div className="card card-creative">
      <div className="flex items-center justify-between mb-4">
        <h3>Currently reading</h3>
        <Link to="/books" style={{ fontSize: 12, color: 'var(--creative)', textDecoration: 'none' }}>Books →</Link>
      </div>
      {loading ? null : books.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
          Nothing on the go. <Link to="/books" style={{ color: 'var(--creative)' }}>Add a book →</Link>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {books.map(b => (
            <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 52, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {b.cover_url ? <img src={b.cover_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={14} color="var(--text-3)" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
