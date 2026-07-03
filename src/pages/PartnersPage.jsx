import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Users, Copy, UserPlus, MessageSquare, BarChart2, Send, ChevronDown, ChevronRight, ClipboardList, Check, Trash2, Plus } from 'lucide-react'
import TaskExpansion from '../components/weekly/TaskExpansion'

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
      <button className="btn btn-ghost btn-xs" onClick={() => setOpen(true)} title="Send a nudge to your partner" style={{ fontSize: 11 }}>
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
      <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={send} disabled={sending} title="Send nudge"><Send size={11} /></button>
      <button className="btn btn-xs btn-ghost" onClick={() => setOpen(false)} title="Cancel">✕</button>
    </div>
  )
}

function AssignmentRow({ a, isMine, onToggle, onDelete, onAccept, onDecline }) {
  const [decliningOpen, setDecliningOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const myComplete = isMine ? a.complete_from : a.complete_to
  const theirComplete = isMine ? a.complete_to : a.complete_from
  const bothDone = a.complete_from && a.complete_to
  const status = a.status || 'accepted' // old rows without status field default to accepted

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="flex items-center gap-2">
        {/* Completion tick — only shown once accepted */}
        {status === 'accepted' && onToggle ? (
          <button
            onClick={onToggle}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}
            title={myComplete ? 'Mark as not done' : 'Mark as done'}
          >
            {myComplete ? '✅' : '⬜'}
          </button>
        ) : status === 'accepted' ? (
          <span style={{ fontSize: 13, flexShrink: 0 }}>{theirComplete ? '✅' : '⬜'}</span>
        ) : status === 'declined' ? (
          <span style={{ fontSize: 13, flexShrink: 0 }}>✕</span>
        ) : (
          <span style={{ fontSize: 13, flexShrink: 0, color: 'var(--text-3)' }}>⬜</span>
        )}

        <span style={{
          fontSize: 13, flex: 1,
          textDecoration: (status === 'declined' || bothDone) ? 'line-through' : 'none',
          color: (status === 'declined' || bothDone) ? 'var(--text-3)' : 'var(--text)',
        }}>
          {a.text}
        </span>

        {a.is_joint && status === 'accepted' && (
          <span className="badge" style={{ fontSize: 9, background: 'var(--career-tint)', color: 'var(--career)' }}>joint</span>
        )}
        {status === 'pending' && !isMine && (
          <span className="badge" style={{ fontSize: 9, background: 'var(--warning-tint, #fef3c7)', color: 'var(--warning)' }}>pending</span>
        )}
        {status === 'pending' && isMine && (
          <span className="badge" style={{ fontSize: 9, background: 'var(--bg-3)', color: 'var(--text-3)' }}>awaiting</span>
        )}
        {status === 'declined' && (
          <span className="badge" style={{ fontSize: 9, background: '#ef444415', color: '#ef4444' }}>declined</span>
        )}
        {status === 'accepted' && bothDone && (
          <span className="badge badge-success" style={{ fontSize: 9 }}>Done</span>
        )}
        {onDelete && (
          <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)' }} onClick={onDelete} title="Delete">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {a.note && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 23, fontStyle: 'italic' }}>{a.note}</p>
      )}

      {/* Decline reason */}
      {status === 'declined' && a.decline_reason && (
        <p style={{ fontSize: 11, color: '#ef4444', paddingLeft: 23, fontStyle: 'italic' }}>"{a.decline_reason}"</p>
      )}

      <div className="flex items-center gap-2 wrap" style={{ paddingLeft: 23 }}>
        {a.due_date && <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>due {a.due_date}</span>}
        {status === 'accepted' && a.is_joint && (
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
            {isMine ? (a.complete_to ? '· they done' : '· they pending') : (a.complete_from ? '· you done' : '· you pending')}
          </span>
        )}

        {/* Accept / Decline buttons for the assignee when status is pending */}
        {status === 'pending' && !isMine && !decliningOpen && (
          <>
            <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={onAccept}>
              <Check size={10} /> Accept
            </button>
            <button className="btn btn-xs btn-ghost" style={{ color: '#ef4444' }} onClick={() => setDecliningOpen(true)}>
              Decline
            </button>
          </>
        )}
        {decliningOpen && (
          <div className="flex items-center gap-1" style={{ width: '100%', marginTop: 2 }}>
            <input
              autoFocus
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { onDecline(declineReason); setDecliningOpen(false) } if (e.key === 'Escape') setDecliningOpen(false) }}
              placeholder="Reason (optional)…"
              style={{ fontSize: 12, flex: 1, padding: '3px 8px' }}
            />
            <button className="btn btn-xs" style={{ background: '#ef4444', color: '#fff' }} onClick={() => { onDecline(declineReason); setDecliningOpen(false) }}>Send</button>
            <button className="btn btn-xs btn-ghost" onClick={() => setDecliningOpen(false)}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const { user } = useAuth()
  const [partners, setPartners] = useState([])
  const [partnerTasks, setPartnerTasks] = useState({}) // userId -> weekly tasks
  const [partnerTodos, setPartnerTodos] = useState({}) // userId -> today's daily todos
  const [partnerGoals, setPartnerGoals] = useState({}) // userId -> goals[]
  const [expandedTask, setExpandedTask] = useState(null) // task id
  const [assignments, setAssignments] = useState([]) // all partner_assignments involving me
  const [showAssignForm, setShowAssignForm] = useState(null) // partnerId or null
  const [assignText, setAssignText] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [assignJoint, setAssignJoint] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [myCode, setMyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user) { loadMyCode(); loadPartners(); loadAssignments() }
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
        const [taskRes, todoRes, goalRes] = await Promise.all([
          supabase.from('weekly_tasks').select('*').eq('user_id', row.partner_id).eq('week_start', weekStartStr).order('created_at', { ascending: false }).limit(20),
          supabase.from('daily_todos').select('*').eq('user_id', row.partner_id).eq('date', todayStr).eq('archived', false).order('sort_order'),
          supabase.from('goals').select('id, primary_goal, category').eq('user_id', row.partner_id),
        ])
        return [row.partner_id, taskRes.data || [], todoRes.data || [], goalRes.data || []]
      })
      const results = await Promise.all(taskPromises)
      setPartnerTasks(Object.fromEntries(results.map(([id, tasks]) => [id, tasks])))
      setPartnerTodos(Object.fromEntries(results.map(([id, , todos]) => [id, todos])))
      setPartnerGoals(Object.fromEntries(results.map(([id, , , goals]) => [id, goals])))
    } else {
      setPartners([])
      setPartnerTasks({})
      setPartnerTodos({})
    }
    setLoading(false)
  }

  async function loadAssignments() {
    // Load tasks I assigned out + tasks assigned to me
    const [outRes, inRes] = await Promise.all([
      supabase.from('partner_assignments').select('*').eq('from_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('partner_assignments').select('*').eq('to_user_id', user.id).order('created_at', { ascending: false }),
    ])
    setAssignments([...(outRes.data || []), ...(inRes.data || [])])
  }

  async function createAssignment(toUserId) {
    if (!assignText.trim()) return
    const { data } = await supabase.from('partner_assignments').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      text: assignText.trim(),
      note: assignNote.trim() || null,
      due_date: assignDue || null,
      is_joint: assignJoint,
    }).select().single()
    if (data) setAssignments(prev => [data, ...prev])
    setAssignText(''); setAssignNote(''); setAssignDue(''); setAssignJoint(false)
    setShowAssignForm(null)
  }

  async function toggleAssignmentComplete(a) {
    const isMine = a.from_user_id === user.id
    const field = isMine ? 'complete_from' : 'complete_to'
    const next = isMine ? !a.complete_from : !a.complete_to
    await supabase.from('partner_assignments').update({ [field]: next }).eq('id', a.id)
    setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, [field]: next } : x))
  }

  async function deleteAssignment(id) {
    await supabase.from('partner_assignments').delete().eq('id', id)
    setAssignments(prev => prev.filter(x => x.id !== id))
  }

  async function acceptAssignment(id) {
    await supabase.from('partner_assignments').update({ status: 'accepted' }).eq('id', id)
    setAssignments(prev => prev.map(x => x.id === id ? { ...x, status: 'accepted' } : x))
    // Insert into today's daily todos so it shows up in normal workflow
    const a = assignments.find(x => x.id === id)
    if (a) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('daily_todos').insert({
        user_id: user.id,
        text: a.text,
        date: today,
        complete: false,
        category: 'Personal',
        ...(a.note ? { notes: a.note } : {}),
      })
    }
  }

  async function declineAssignment(id, reason) {
    await supabase.from('partner_assignments').update({ status: 'declined', decline_reason: reason || null }).eq('id', id)
    setAssignments(prev => prev.map(x => x.id === id ? { ...x, status: 'declined', decline_reason: reason || null } : x))
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
                    tasks.slice(0, 10).map(task => {
                      const isExpanded = expandedTask === task.id
                      return (
                      <div key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div
                          className="flex items-center gap-2"
                          style={{ padding: '8px 0', cursor: 'pointer' }}
                          onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        >
                          <span style={{ fontSize: 13, fontWeight: 500, textDecoration: task.complete ? 'line-through' : 'none', color: task.complete ? 'var(--text-3)' : 'var(--text)', flex: 1 }}>
                            {task.specific_task}
                          </span>
                          {task.complete
                            ? <span className="badge badge-success" style={{ fontSize: 9 }}>Done</span>
                            : <NudgeInline partnerId={p.partner_id} taskId={task.id} label="Nudge" />
                          }
                          {isExpanded ? <ChevronDown size={13} color="var(--text-3)" /> : <ChevronRight size={13} color="var(--text-3)" />}
                        </div>
                        <div className="flex items-center gap-2 wrap" style={{ paddingBottom: 6 }}>
                          {task.area && <span className="badge" style={{ fontSize: 9 }}>{task.area}</span>}
                          {task.action && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{task.action}</span>}
                          {task.frequency && task.frequency !== 'One-off' && <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{task.frequency}</span>}
                          {task.carried_forward && <span className="badge badge-warning" style={{ fontSize: 9 }}>carried</span>}
                        </div>
                        {isExpanded && (
                          <div style={{ paddingBottom: 10 }}>
                            <TaskExpansion
                              task={task}
                              goals={partnerGoals[p.partner_id] || []}
                              readOnly
                              onUpdateField={() => {}}
                              onToggleSubtask={() => {}}
                              onAddSubtask={() => {}}
                              onEditSubtask={() => {}}
                              onRemoveSubtask={() => {}}
                              onReorderSubtasks={() => {}}
                            />
                          </div>
                        )}
                      </div>
                      )
                    })
                  )}
                </div>

                {/* Today's daily todos */}
                <div style={{ marginBottom: 16 }}>
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

                {/* Assigned / joint tasks */}
                {(() => {
                  const outgoing = assignments.filter(a => a.from_user_id === user.id && a.to_user_id === p.partner_id)
                  const incoming = assignments.filter(a => a.to_user_id === user.id && a.from_user_id === p.partner_id)
                  const partnerName = p.partner?.display_name || p.partner?.email?.split('@')[0] || 'Partner'
                  return (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList size={13} color="var(--career)" />
                        <p style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Assigned tasks</p>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => { setShowAssignForm(showAssignForm === p.partner_id ? null : p.partner_id); setAssignText(''); setAssignNote(''); setAssignDue(''); setAssignJoint(false) }}
                        >
                          <Plus size={11} /> Assign task
                        </button>
                      </div>

                      {showAssignForm === p.partner_id && (
                        <div className="card" style={{ background: 'var(--bg-2)', padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            autoFocus
                            value={assignText}
                            onChange={e => setAssignText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createAssignment(p.partner_id)}
                            placeholder="Task description…"
                            style={{ fontSize: 13 }}
                          />
                          <input
                            value={assignNote}
                            onChange={e => setAssignNote(e.target.value)}
                            placeholder="Add a note (optional)"
                            style={{ fontSize: 12 }}
                          />
                          <div className="flex items-center gap-3 wrap">
                            <input type="date" value={assignDue} onChange={e => setAssignDue(e.target.value)} style={{ fontSize: 12 }} />
                            <label className="flex items-center gap-2" style={{ fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={assignJoint} onChange={e => setAssignJoint(e.target.checked)} />
                              Joint task (we both track it)
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={() => createAssignment(p.partner_id)}>
                              Assign to {partnerName}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowAssignForm(null)}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {incoming.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>From {partnerName}</p>
                          {incoming.map(a => (
                            <AssignmentRow
                              key={a.id} a={a} isMine={false}
                              onToggle={(a.status === 'accepted' || !a.status) ? () => toggleAssignmentComplete(a) : null}
                              onDelete={null}
                              onAccept={() => acceptAssignment(a.id)}
                              onDecline={reason => declineAssignment(a.id, reason)}
                            />
                          ))}
                        </div>
                      )}

                      {outgoing.length > 0 && (
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Assigned to {partnerName}</p>
                          {outgoing.map(a => (
                            <AssignmentRow
                              key={a.id} a={a} isMine={true}
                              onToggle={(a.is_joint && (a.status === 'accepted' || !a.status)) ? () => toggleAssignmentComplete(a) : null}
                              onDelete={() => deleteAssignment(a.id)}
                              onAccept={null}
                              onDecline={null}
                            />
                          ))}
                        </div>
                      )}

                      {incoming.length === 0 && outgoing.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No assigned tasks yet.</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
