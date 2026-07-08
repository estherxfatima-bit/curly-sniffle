import { useState, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Sparkles, ChevronDown, ChevronUp, Moon, RefreshCw } from 'lucide-react'

const DAY_EMOJIS = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '✨' }
const RATING_LABELS = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' }
const RATING_COLORS = { 1: 'var(--danger)', 2: 'var(--warning)', 3: 'var(--text-3)', 4: 'var(--success)', 5: 'var(--career)' }

const RANGE_OPTIONS = [
  { label: '7 days',  days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

async function callClaude(prompt, system, maxTokens = 800) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }], skip_user_context: true }),
  })
  if (!res.ok) throw new Error('AI request failed')
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

function RatingSparkline({ entries }) {
  const rated = entries.filter(e => e.day_rating)
  if (rated.length < 2) return null
  const W = 280, H = 44, pad = 6
  const xs = rated.map((_, i) => pad + (i / (rated.length - 1)) * (W - pad * 2))
  const y = v => H - pad - ((v - 1) / 4) * (H - pad * 2)
  const points = rated.map((e, i) => `${xs[i]},${y(e.day_rating)}`).join(' ')
  const avg = rated.reduce((s, e) => s + e.day_rating, 0) / rated.length

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mood trend</p>
        <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>avg {avg.toFixed(1)} {DAY_EMOJIS[Math.round(avg)]}</p>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <polyline points={points} fill="none" stroke="var(--wellness)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
        {rated.map((e, i) => (
          <circle key={i} cx={xs[i]} cy={y(e.day_rating)} r={i === rated.length - 1 ? 4 : 3}
            fill={RATING_COLORS[e.day_rating] || 'var(--wellness)'} opacity={0.85} />
        ))}
        {/* Day labels — only first and last */}
        <text x={xs[0]} y={H + 14} textAnchor="middle" fontSize={9} fill="var(--text-3)" fontFamily="var(--font-mono)">
          {format(parseISO(rated[0].date), 'd MMM')}
        </text>
        <text x={xs[xs.length - 1]} y={H + 14} textAnchor="middle" fontSize={9} fill="var(--text-3)" fontFamily="var(--font-mono)">
          {format(parseISO(rated[rated.length - 1].date), 'd MMM')}
        </text>
      </svg>
    </div>
  )
}

function EntryCard({ entry }) {
  const [open, setOpen] = useState(false)
  const hasPriorities = entry.tomorrow_priorities?.length > 0
  const hasText = !!entry.reflection_text

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ width: '100%', textAlign: 'left', background: 'none', padding: 0, display: 'flex', alignItems: 'flex-start', gap: 12 }}
      >
        {/* Date + rating */}
        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 40 }}>
          <p style={{ fontSize: 18, lineHeight: 1 }}>{entry.day_rating ? DAY_EMOJIS[entry.day_rating] : '—'}</p>
          {entry.day_rating && (
            <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: RATING_COLORS[entry.day_rating], marginTop: 2 }}>
              {RATING_LABELS[entry.day_rating]}
            </p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {format(parseISO(entry.date), 'EEEE, d MMMM yyyy')}
          </p>
          {!open && hasText && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.reflection_text}
            </p>
          )}
          {!hasText && !hasPriorities && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 3 }}>Rating only</p>
          )}
        </div>

        <div style={{ flexShrink: 0, color: 'var(--text-3)' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {hasText && (
            <div style={{ marginBottom: hasPriorities ? 12 : 0 }}>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Reflection</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.reflection_text}</p>
            </div>
          )}
          {hasPriorities && (
            <div>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Tomorrow's priorities</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entry.tomorrow_priorities.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--wellness)', fontSize: 11, flexShrink: 0, marginTop: 2 }}>▸</span>
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AIAnalysisPanel({ entries }) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)

  async function run() {
    setLoading(true)
    setRan(true)
    try {
      const snapshot = entries
        .filter(e => e.reflection_text || e.day_rating)
        .slice(0, 30)
        .map(e => {
          const parts = [`Date: ${e.date}`]
          if (e.day_rating) parts.push(`Rating: ${e.day_rating}/5 (${RATING_LABELS[e.day_rating]})`)
          if (e.reflection_text) parts.push(`Reflection: ${e.reflection_text}`)
          if (e.tomorrow_priorities?.length) parts.push(`Tomorrow's goals: ${e.tomorrow_priorities.join(', ')}`)
          return parts.join('\n')
        })
        .join('\n\n---\n\n')

      if (!snapshot.trim()) { setAnalysis('Not enough reflection data yet — write a few more entries first.'); setLoading(false); return }

      const text = await callClaude(
        `Here are my recent daily reflection journal entries:\n\n${snapshot}\n\nPlease analyse these and identify:\n1. **Mood patterns** — when do I tend to feel better or worse? Any recurring cycles?\n2. **Energy themes** — what drains vs energises me based on what I write?\n3. **Focus patterns** — what do I keep prioritising tomorrow vs actually doing?\n4. **Recurring challenges** — anything I mention repeatedly that might need addressing?\n5. **What's working** — positive patterns or wins I should keep doing\n\nBe specific and reference actual things I wrote. Keep it honest but constructive. 300-400 words.`,
        'You are a thoughtful journaling coach analysing someone\'s personal daily reflections. Be warm, insightful, and specific — reference what they actually wrote. Identify real patterns, not generic advice. Format with bold headers for each section.'
      , 600)
      setAnalysis(text)
    } catch {
      setAnalysis('Could not load analysis — please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 24, border: '1px solid color-mix(in srgb, var(--wellness) 30%, transparent)', background: 'color-mix(in srgb, var(--wellness) 5%, var(--card-bg))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: analysis ? 14 : 0 }}>
        <Sparkles size={15} color="var(--wellness)" />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>AI pattern analysis</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Spot trends and patterns across your reflections</p>
        </div>
        <button
          className="btn btn-sm"
          onClick={run}
          disabled={loading}
          style={{ background: 'var(--wellness)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {loading ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</> : ran ? <><RefreshCw size={11} /> Re-analyse</> : <>Analyse</>}
        </button>
      </div>

      {analysis && (
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {analysis.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} style={{ fontWeight: 700, color: 'var(--text)', marginTop: i > 0 ? 12 : 0, marginBottom: 3 }}>{line.replace(/\*\*/g, '')}</p>
            }
            if (line.match(/^\*\*.*\*\*/)) {
              return <p key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            }
            return line ? <p key={i} style={{ marginBottom: 4 }}>{line}</p> : <div key={i} style={{ height: 4 }} />
          })}
        </div>
      )}
    </div>
  )
}

export default function ReflectionsPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeDays, setRangeDays] = useState(30)

  useEffect(() => {
    if (!user) return
    loadEntries()
  }, [user, rangeDays])

  async function loadEntries() {
    setLoading(true)
    const from = format(subDays(new Date(), rangeDays), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('daily_reflections')
      .select('date, reflection_text, tomorrow_priorities, day_rating')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const entriesWithContent = entries.filter(e => e.reflection_text || e.day_rating || e.tomorrow_priorities?.length)
  const ratedEntries = [...entriesWithContent].reverse()

  return (
    <div>
      <div className="page-header header-wellness mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Reflections</h1>
            <p>Your daily journal — thoughts, patterns, and how your days feel</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {RANGE_OPTIONS.map(o => (
              <button
                key={o.days}
                onClick={() => setRangeDays(o.days)}
                className="btn btn-xs"
                style={{
                  background: rangeDays === o.days ? 'var(--wellness)' : 'var(--bg-2)',
                  color: rangeDays === o.days ? '#fff' : 'var(--text-3)',
                  border: `1px solid ${rangeDays === o.days ? 'var(--wellness)' : 'var(--border)'}`,
                }}
              >{o.label}</button>
            ))}
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--wellness)' }}>
          <Moon size={48} opacity={0.15} />
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : entriesWithContent.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <Moon size={32} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No reflections yet in this period</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Complete tonight's reflection from the notification or the dashboard to start building your journal.</p>
        </div>
      ) : (
        <>
          {/* Mood sparkline */}
          {ratedEntries.length >= 2 && (
            <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
              <RatingSparkline entries={ratedEntries} />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(
                  entriesWithContent.reduce((acc, e) => { if (e.day_rating) acc[e.day_rating] = (acc[e.day_rating] || 0) + 1; return acc }, {})
                ).sort((a, b) => b[0] - a[0]).map(([r, count]) => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14 }}>{DAY_EMOJIS[r]}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: RATING_COLORS[r] }}>{count}×</span>
                  </div>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{entriesWithContent.length} entries</span>
              </div>
            </div>
          )}

          {/* AI analysis */}
          <AIAnalysisPanel entries={entriesWithContent} />

          {/* Entries list */}
          <div>
            {entriesWithContent.map(e => <EntryCard key={e.date} entry={e} />)}
          </div>
        </>
      )}
    </div>
  )
}
