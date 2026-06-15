import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Users, Copy, UserPlus, X, MessageSquare } from 'lucide-react'

export default function PartnersPage() {
  const { user } = useAuth()
  const [partners, setPartners] = useState([])
  const [partnerTasks, setPartnerTasks] = useState({}) // userId -> tasks
  const [inviteCode, setInviteCode] = useState('')
  const [myCode, setMyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [nudgeText, setNudgeText] = useState({})

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

      // Load each partner's tasks
      const taskPromises = partnerRows.map(async (row) => {
        const { data } = await supabase
          .from('weekly_tasks')
          .select('*')
          .eq('user_id', row.partner_id)
          .order('created_at', { ascending: false })
          .limit(20)
        return [row.partner_id, data || []]
      })
      const results = await Promise.all(taskPromises)
      setPartnerTasks(Object.fromEntries(results))
    } else {
      setPartners([])
      setPartnerTasks({})
    }
    setLoading(false)
  }

  async function addPartner() {
    if (!inviteCode.trim()) return
    const code = inviteCode.trim().toUpperCase()
    const { error } = await supabase.rpc('connect_accountability_partner', { p_code: code })
    if (error) { alert(error.message.includes('own code') ? "That's your own code!" : 'No user found with that code.'); return }

    setInviteCode('')
    loadPartners()
  }

  async function leaveNudge(partnerId, taskId) {
    const text = nudgeText[taskId]
    if (!text?.trim()) return
    await supabase.from('comments').insert({
      user_id: user.id,
      task_id: taskId,
      partner_id: partnerId,
      content: text,
    })
    setNudgeText(prev => ({ ...prev, [taskId]: '' }))
    alert('Nudge sent!')
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
            const partnerName = p.partner?.display_name || p.partner?.email?.split('@')[0] || 'Partner'
            return (
              <div key={p.id} className="card">
                <h3 className="mb-4" style={{ fontSize: '1rem' }}>{partnerName}'s tasks</h3>
                {tasks.length === 0 ? (
                  <p className="text-dim" style={{ fontSize: '12px' }}>No tasks visible yet.</p>
                ) : (
                  tasks.slice(0, 10).map(task => (
                    <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '13px', textDecoration: task.complete ? 'line-through' : 'none', color: task.complete ? 'var(--text-3)' : 'var(--text)' }}>
                          {task.specific_task}
                        </span>
                        {task.complete && <span className="badge badge-success">Done</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={nudgeText[task.id] || ''}
                          onChange={e => setNudgeText(prev => ({ ...prev, [task.id]: e.target.value }))}
                          placeholder="Leave a nudge…"
                          style={{ fontSize: '12px', flex: 1 }}
                          onKeyDown={e => e.key === 'Enter' && leaveNudge(p.partner_id, task.id)}
                        />
                        <button className="btn btn-ghost btn-sm" onClick={() => leaveNudge(p.partner_id, task.id)}>
                          <MessageSquare size={12} />
                          Nudge
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
