import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Users, Copy, UserPlus, MessageSquare, BarChart2, Send } from 'lucide-react'

function NudgeInline({ partnerId, taskId = null, onSent, label = 'Nudge' }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('comments').insert({ user_id: user.id, task_id: taskId, partner_id: partnerId, content: text.trim() })
    setText('')
    setOpen(false)
    setSending(false)
    onSent?.()
  }

  if (!open) {
    return (
      <button className="btn btn-ghost btn-xs" onClick={() => setOpen(true)} style={{ fontSize: 11 }}>
        <MessageSquare size={11} /> {label}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') send(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Write a nudge…"
        style={{ fontSize: 12, flex: 1, padding: '3px 8px' }}
      />
      <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={send} disabled={sending}><Send size={11} /></button>
      <button className="btn btn-xs btn-ghost" onClick={() => setOpen(false)}>✕</button>
    </div>
  )
}

export default function PartnersPage() {
  const { user } = useAuth()
  const [partners, setPartners] = useState([])
  const [partnerTasks, setPartnerTasks] = useState({}) // userId -> weekly tasks
  const [partnerTodos, setPartnerTodos] = useState({}) // userId -> today's daily todos
  const [inviteCode, setInviteCode] = useState('')
  const [myCode, setMyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user) { loadMyCode(); loadPartners() }
  }, [user])

  async function loadMyCode() {
    const { data } = await supabase.from('profiles').select('invite_code').eq('id', user.id).single()
    if (data?.invite_code) {
      setMyCode(data.invite_code)
    } else {
      // Generate a new invite code
      const code = Math.random().toString(36).slice(2, 10).toUpperCase()
      await supabase.from('profiles').upsert({ id: user.id, invite_code: code, email: user.email })
      setMyCode(code)
    }
  }

  async function loadPartners() {
    setLoading(true)
    const { data: partnerRows } = await supabase
      .from('accountability_partners')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'accepted')

    if (partnerRows?.length) {
      const partnerIds = partnerRows.map(row => row.partner_id)
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', partnerIds)
      const profilesById = Object.fromEntries((profileRows || []).map(p => [p.id, p]))
      setPartners(partnerRows.map(row => ({ ...row, partner: profilesById[row.partner_id] })))

      const todayStr = new Date().toISOString().slice(0, 10)
      const weekStartStr = (() => {
        const d = new Date()
        const day = d.getDay()
        const diff = (day === 0 ? -6 : 1 - day)
        const ws = new Date(d); ws.setDate(d.getDate() + diff)
        return ws.toISOString().slice(0, 10)
      })()

      const taskPromises = partnerRows.map(async (row) => {
        const [taskRes, todoRes] = await Promise.all([
          supabase.from('weekly_tasks').select('*').eq('user_id', row.partner_id).eq('week_start', weekStartStr).order('created_at', { ascending: false }).limit(20),
          supabase.from('daily_todos').select('*').eq('user_id', row.partner_id).eq('date', todayStr).eq('archived', false).order('sort_order'),
        ])
        return [row.partner_id, taskRes.data || [], todoRes.data || []]
      })
      const results = await Promise.all(taskPromises)
      setPartnerTasks(Object.fromEntries(results.map(([id, tasks]) => [id, tasks])))
      setPartnerTodos(Object.fromEntries(results.map(([id, , todos]) => [id, todos])))
    } else {
      setPartners([])
      setPartnerTasks({})
      setPartnerTodos({})
    }
    setLoading(false)
  }

  async function addPartner() {
    if (!inviteCode.trim()) return
    const code = inviteCode.trim().toUpperCase()
    const { error } = await supabase.rpc('connect_accountability_partner', { p_code: code })
    if (error) {
      if (error.message.includes('own code')) alert("That's your own code!")
      else if (error.message.includes('No user found')) alert('No user found with that code.')
      else alert(`Failed to connect: ${error.message}`)
      return
    }

    setInviteCode('')
    loadPartners()
  }

  function copyCode() {
    navigator.clipboard.writeText(myCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Accountability Partners</h1>
        <p>Share your weekly tasks and habits with people who keep you accountable</p>
      </div>

      {/* My invite code */}
      <div className="card mb-6" style={{ maxWidth: '480px' }}>
        <h3 className="mb-2" style={{ fontSize: '1rem' }}>Your invite code</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>
          Share this 8-character code with someone to connect as accountability partners.
        </p>
        <div className="flex items-center gap-3">
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '22px',
            letterSpacing: '0.2em',
            color: 'var(--accent)',
            background: 'var(--bg-3)',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            flex: 1,
            textAlign: 'center',
          }}>
            {myCode || '…'}
          </div>
          <button className="btn btn-ghost" onClick={copyCode}>
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Add partner */}
      <div className="card mb-6" style={{ maxWidth: '480px' }}>
        <h3 className="mb-2" style={{ fontSize: '1rem' }}>Add a partner</h3>
        <div className="flex gap-2">
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Enter 8-character code"
            maxLength={8}
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
          />
          <button className="btn btn-primary" onClick={addPartner}>
            <UserPlus size={14} />
            Connect
          </button>
        </div>
      </div>

      {/* Partners */}
      {loading ? (
        <p className="text-dim" style={{ padding: '20px', textAlign: 'center' }}>Loading…</p>
      ) : partners.length === 0 ? (
        <div className="empty-state">
          <Users size={32} style={{ marginBottom: '12px', color: 'var(--text-3)' }} />
          <p>No partners yet. Share your invite code to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {partners.map(p => {
            const tasks = partnerTasks[p.partner_id] || []
            const todos = partnerTodos[p.partner_id] || []
            const partnerName = p.partner?.display_name || p.partner?.email?.split('@')[0] || 'Partner'
            return (
              <div key={p.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{ fontSize: '1rem' }}>{partnerName}</h3>
                  <Link
                    to={`/partners/${p.partner_id}/compare`}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12 }}
                  >
                    <BarChart2 size={13} /> Compare
                  </Link>
                </div>

                {/* Weekly tasks */}
                <div style={{ marginBottom: 12 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="mono" style={{ fontSize: 10, flex: 1 }}>This week's tasks</p>
                    <NudgeInline partnerId={p.partner_id} label="Nudge on weekly plan" />
                  </div>
                  {tasks.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing planned this week.</p>
                  ) : (
                    tasks.slice(0, 10).map(task => (
                      <div key={task.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 13, textDecoration: task.complete ? 'line-through' : 'none', color: task.complete ? 'var(--text-3)' : 'var(--text)', flex: 1 }}>
                            {task.specific_task}
                          </span>
                          {task.complete
                            ? <span className="badge badge-success" style={{ fontSize: 9 }}>Done</span>
                            : <NudgeInline partnerId={p.partner_id} taskId={task.id} label="Nudge" />
                          }
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Today's daily todos */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="mono" style={{ fontSize: 10, flex: 1 }}>Today's to-dos</p>
                    <NudgeInline partnerId={p.partner_id} label="Nudge on today" />
                  </div>
                  {todos.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing planned for today.</p>
                  ) : (
                    todos.map(todo => (
                      <div key={todo.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 13 }}>{todo.complete ? '✅' : '⬜'}</span>
                          <span style={{ fontSize: 13, textDecoration: todo.complete ? 'line-through' : 'none', color: todo.complete ? 'var(--text-3)' : 'var(--text)', flex: 1 }}>
                            {todo.text}
                          </span>
                          {!todo.complete && <NudgeInline partnerId={p.partner_id} label="Nudge" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
