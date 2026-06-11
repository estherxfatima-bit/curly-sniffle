import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { searchBooks } from '../lib/openLibrary'
import { getCurrentQuarter } from '../lib/constants'
import { Search, Plus, BookOpen, Check, Pause, X, Trash2 } from 'lucide-react'

const STATUSES = ['reading', 'paused', 'completed']
const STATUS_LABELS = { reading: 'Reading', paused: 'Paused', completed: 'Completed' }

function BooksDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={10 + i * 22} y={10 + (i % 2) * 6} width={16} height={50 - (i % 2) * 6} rx={2} stroke="currentColor" strokeWidth="1.5" opacity={0.15 + i * 0.06} />
      ))}
    </svg>
  )
}

export default function BooksPage() {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => { if (user) loadBooks() }, [user])

  async function loadBooks() {
    setLoading(true)
    const { data } = await supabase.from('books').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setBooks(data || [])
    setLoading(false)
  }

  async function addBook(book) {
    const { data } = await supabase.from('books').insert({
      user_id: user.id, ol_key: book.ol_key, title: book.title, author: book.author,
      cover_url: book.cover_url, status: 'reading', started_at: new Date().toISOString().slice(0, 10),
    }).select().single()
    if (data) setBooks(prev => [data, ...prev])
    setShowSearch(false)
  }

  async function setStatus(book, status) {
    const updates = { status }
    if (status === 'completed') {
      updates.finished_at = new Date().toISOString().slice(0, 10)
      updates.quarter = `${getCurrentQuarter()} ${new Date().getFullYear()}`
    } else {
      updates.finished_at = null
      updates.quarter = null
    }
    await supabase.from('books').update(updates).eq('id', book.id)
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, ...updates } : b))
  }

  async function removeBook(id) {
    if (!confirm('Remove this book?')) return
    await supabase.from('books').delete().eq('id', id)
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  const reading = books.filter(b => b.status === 'reading')
  const paused = books.filter(b => b.status === 'paused')
  const completed = books.filter(b => b.status === 'completed')

  // group completed by quarter
  const byQuarter = {}
  completed.forEach(b => {
    const q = b.quarter || 'Unsorted'
    if (!byQuarter[q]) byQuarter[q] = []
    byQuarter[q].push(b)
  })
  const quarters = Object.keys(byQuarter).sort().reverse()

  return (
    <div>
      <div className="page-header header-creative mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Books</h1>
            <p>Track what you're reading and what you've read</p>
          </div>
          <button className="btn btn-creative btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={() => setShowSearch(true)}>
            <Plus size={14} /> Add book
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--creative)' }}><BooksDecoration /></div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section>
            <h3 style={{ marginBottom: 14 }}>Currently reading</h3>
            {reading.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing on the go. Add a book to start tracking.</p>
            ) : (
              <div className="grid-3" style={{ gap: 14 }}>
                {reading.map(b => <BookCard key={b.id} book={b} onSetStatus={setStatus} onRemove={removeBook} />)}
              </div>
            )}
          </section>

          {paused.length > 0 && (
            <section>
              <h3 style={{ marginBottom: 14 }}>Paused</h3>
              <div className="grid-3" style={{ gap: 14 }}>
                {paused.map(b => <BookCard key={b.id} book={b} onSetStatus={setStatus} onRemove={removeBook} />)}
              </div>
            </section>
          )}

          <section>
            <h3 style={{ marginBottom: 14 }}>Books read</h3>
            {quarters.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing finished yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {quarters.map(q => (
                  <div key={q}>
                    <p className="mono mb-2">{q}</p>
                    <div className="grid-3" style={{ gap: 14 }}>
                      {byQuarter[q].map(b => <BookCard key={b.id} book={b} onSetStatus={setStatus} onRemove={removeBook} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showSearch && <BookSearchModal onAdd={addBook} onClose={() => setShowSearch(false)} />}
    </div>
  )
}

function BookCard({ book, onSetStatus, onRemove }) {
  return (
    <div className="card card-creative" style={{ display: 'flex', gap: 12, padding: 14 }}>
      <div style={{
        width: 52, height: 76, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
        background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <BookOpen size={18} color="var(--text-3)" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{book.title}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</p>
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-1" style={{ marginTop: 8 }}>
          {STATUSES.map(s => (
            <button
              key={s}
              className="btn-icon btn-sm"
              title={STATUS_LABELS[s]}
              onClick={() => onSetStatus(book, s)}
              style={{
                color: book.status === s ? 'var(--creative)' : 'var(--text-3)',
                background: book.status === s ? 'var(--creative-tint, var(--bg-2))' : 'transparent',
              }}
            >
              {s === 'reading' && <BookOpen size={12} />}
              {s === 'paused' && <Pause size={12} />}
              {s === 'completed' && <Check size={12} />}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn-icon btn-sm" onClick={() => onRemove(book.id)}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

function BookSearchModal({ onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const r = await searchBooks(query)
      setResults(r)
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <div className="modal-overlay">
      <div className="modal scale-in" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.3rem' }}>Add a book</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-group">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title…" autoFocus style={{ paddingLeft: 34 }} />
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searching && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 12 }}>Searching…</p>}
          {!searching && query.trim() && results.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 12, fontStyle: 'italic' }}>No results.</p>
          )}
          {results.map((b, i) => (
            <div key={i} onClick={() => onAdd(b)} style={{ display: 'flex', gap: 10, padding: 8, borderRadius: 'var(--radius)', cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 36, height: 52, borderRadius: 3, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {b.cover_url ? <img src={b.cover_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={14} color="var(--text-3)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{b.author}</p>
              </div>
              <Plus size={14} color="var(--creative)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
