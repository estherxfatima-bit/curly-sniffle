import { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { StickyNote, X } from 'lucide-react'

export default function NoteForTomorrow({ today }) {
  const { user } = useAuth()
  const yesterday = format(subDays(new Date(`${today}T00:00:00`), 1), 'yyyy-MM-dd')
  const tomorrow  = format(addDays(new Date(`${today}T00:00:00`), 1), 'yyyy-MM-dd')

  const [incomingNote, setIncomingNote] = useState('')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('daily_reflections')
      .select('date, note_for_tomorrow')
      .eq('user_id', user.id)
      .in('date', [yesterday, today])

    setIncomingNote(data?.find(r => r.date === yesterday)?.note_for_tomorrow || '')
    setDraft(data?.find(r => r.date === today)?.note_for_tomorrow || '')
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user, today])

  async function save() {
    setSaving(true)
    await supabase.from('daily_reflections').upsert({
      user_id: user.id,
      date: today,
      note_for_tomorrow: draft.trim() || null,
    }, { onConflict: 'user_id,date' })
    setSaving(false)
  }

  async function dismissIncoming() {
    setIncomingNote('')
    await supabase.from('daily_reflections').update({ note_for_tomorrow: null })
      .eq('user_id', user.id).eq('date', yesterday)
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote size={14} color="var(--creative)" />
        <h3>Notes</h3>
      </div>

      {!loading && incomingNote && (
        <div className="mb-3" style={{ background: 'var(--creative-tint)', borderRadius: 'var(--radius)', padding: '8px 10px', position: 'relative' }}>
          <p style={{ fontSize: 10, color: 'var(--creative)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Note from yesterday
          </p>
          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', paddingRight: 18 }}>{incomingNote}</p>
          <button className="btn-icon" style={{ position: 'absolute', top: 6, right: 6, padding: 2 }} onClick={dismissIncoming} title="Dismiss">
            <X size={12} />
          </button>
        </div>
      )}

      <p className="mono mb-2" style={{ fontSize: 11 }}>Note for {format(new Date(`${tomorrow}T00:00:00`), 'EEEE')}</p>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        placeholder="Leave yourself a note for tomorrow…"
        rows={3}
        style={{ fontSize: 13, width: '100%', resize: 'vertical' }}
      />
      {saving && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>Saving…</p>}
    </div>
  )
}
