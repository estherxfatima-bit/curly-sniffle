import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CONTENT_PILLARS } from '../../lib/constants'
import { Plus, Trash2, X, ExternalLink } from 'lucide-react'

function detectPlatform(url) {
  if (!url) return 'Link'
  if (url.includes('tiktok.com')) return 'TikTok'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('pinterest.com')) return 'Pinterest'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X'
  return 'Link'
}

const PLATFORM_COLORS = {
  TikTok: '#ff2d55',
  Instagram: '#e1306c',
  YouTube: '#ff0000',
  Pinterest: '#e60023',
  X: '#1da1f2',
  Link: 'var(--text-3)',
}

export default function InspirationTab() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ url: '', notes: '', tags: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('content_inspiration').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [user])

  const toggleTag = (tag) => {
    setForm(p => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag]
    }))
  }

  async function save() {
    if (!form.url.trim()) return
    setSaving(true)
    const platform = detectPlatform(form.url)
    const { data } = await supabase.from('content_inspiration').insert({
      user_id: user.id,
      url: form.url,
      platform,
      notes: form.notes,
      tags: form.tags,
    }).select().single()
    if (data) setItems(prev => [data, ...prev])
    setForm({ url: '', notes: '', tags: [] })
    setShowAdd(false)
    setSaving(false)
  }

  async function deleteItem(id) {
    await supabase.from('content_inspiration').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-dim">Save inspiration from anywhere — TikTok, Instagram, YouTube, Pinterest.</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
          <Plus size={14} /> Add URL
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="form-group">
            <label>URL</label>
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://…" autoFocus />
            {form.url && (
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                Platform: {detectPlatform(form.url)}
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Why did you save this? What caught your eye?" style={{ minHeight: '60px' }} />
          </div>
          <div className="form-group">
            <label>Tags (pillars)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CONTENT_PILLARS.map(p => (
                <button
                  key={p}
                  onClick={() => toggleTag(p)}
                  className={`btn btn-sm ${form.tags.includes(p) ? 'btn-accent' : 'btn-ghost'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state"><p>No saved inspiration yet. Start adding URLs from your saved posts.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {items.map(item => (
            <div key={item.id} className="card card-sm" style={{ position: 'relative' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="badge" style={{ background: `${PLATFORM_COLORS[item.platform]}22`, color: PLATFORM_COLORS[item.platform] }}>
                  {item.platform}
                </span>
                <button className="btn-icon btn" style={{ padding: '2px' }} onClick={() => deleteItem(item.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--cobalt)', wordBreak: 'break-all', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ExternalLink size={11} />
                {item.url.length > 50 ? item.url.slice(0, 50) + '…' : item.url}
              </a>
              {item.notes && (
                <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px', lineHeight: '1.5' }}>{item.notes}</p>
              )}
              {item.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {item.tags.map(t => <span key={t} className="badge badge-accent">{t}</span>)}
                </div>
              )}
              <p className="mono mt-2">{new Date(item.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
