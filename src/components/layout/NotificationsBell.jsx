import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { Bell, X, MessageSquare, Flame, CalendarDays, Info, Sun, Moon, ListTodo, Users, ClipboardList, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const TYPE_ICON = {
  nudge:            { icon: MessageSquare, color: 'var(--personal)' },
  streak_warning:   { icon: Flame,         color: 'var(--warning)'  },
  review_reminder:  { icon: CalendarDays,  color: 'var(--career)'   },
  morning_reminder: { icon: Sun,           color: 'var(--creative)' },
  reflection:           { icon: Moon,    color: 'var(--wellness)' },
  plan_tomorrow:        { icon: ListTodo, color: 'var(--career)'   },
  partner_nudge_prompt: { icon: Users,          color: 'var(--personal)' },
  task_assigned:        { icon: ClipboardList,  color: 'var(--career)'   },
}

function NudgeThread({ notification, currentUserId, onClose }) {
  const senderId = notification.metadata?.sender_id
  const senderName = notification.metadata?.sender_name || 'Partner'
  const [thread, setThread] = useState(null) // null = not loaded yet
  const [loadingThread, setLoadingThread] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  async function loadThread() {
    if (!senderId) return
    setLoadingThread(true)
    // All comments between this pair in either direction
    const { data } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id')
      .or(`and(user_id.eq.${currentUserId},partner_id.eq.${senderId}),and(user_id.eq.${senderId},partner_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .limit(30)
    setThread(data || [])
    setLoadingThread(false)
  }

  function toggleExpand() {
    if (!expanded && thread === null) loadThread()
    setExpanded(v => !v)
  }

  async function sendReply() {
    const content = replyText.trim()
    if (!content || !senderId) return
    setSending(true)
    await supabase.from('comments').insert({
      user_id: currentUserId,
      partner_id: senderId,
      content,
    })
    // Notify the partner
    await supabase.from('notifications').upsert([{
      user_id: senderId,
      type: 'nudge',
      title: `Reply received`,
      body: content,
      link: '/weekly',
      source_id: `reply:${currentUserId}:${Date.now()}`,
      metadata: { sender_id: currentUserId },
    }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
    setReplyText('')
    // Reload thread
    await loadThread()
    setSending(false)
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={toggleExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--personal)', background: 'none', padding: 0, border: 'none', cursor: 'pointer' }}
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? 'Hide thread' : `Reply to ${senderName}`}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
          {loadingThread ? (
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</p>
          ) : (thread || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, maxHeight: 180, overflowY: 'auto' }}>
              {(thread || []).map(c => {
                const isMe = c.user_id === currentUserId
                return (
                  <div key={c.id} style={{ textAlign: isMe ? 'right' : 'left' }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '85%',
                      background: isMe ? 'var(--personal)' : 'var(--bg-3)',
                      color: isMe ? '#fff' : 'var(--text)',
                      borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                      padding: '5px 10px', fontSize: 12, lineHeight: 1.4,
                    }}>
                      {c.content}
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {isMe ? 'You' : senderName} · {format(new Date(c.created_at), 'd MMM HH:mm')}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontStyle: 'italic' }}>No prior messages.</p>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendReply() }}
              placeholder={`Reply to ${senderName}…`}
              style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
            />
            <button
              className="btn btn-xs"
              style={{ background: 'var(--personal)', color: '#fff', flexShrink: 0 }}
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
            >
              <Send size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NotificationsBell({ variant = 'sidebar' }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  useLockBodyScroll(open)
  const navigate = useNavigate()

  function handleClick(n) {
    if (!n.read) markRead(n.id)
    if (n.type !== 'nudge' && n.link) { setOpen(false); navigate(n.link) }
  }

  const buttonStyle = variant === 'sidebar'
    ? { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-2)', color: 'var(--text-3)', fontSize: '13px', border: '1px solid var(--border)' }
    : { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0', background: 'transparent', color: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }

  return (
    <>
      <div style={{ position: 'relative', width: variant === 'sidebar' ? '100%' : 'auto', flex: variant === 'sidebar' ? undefined : 1 }}>
        <button onClick={() => setOpen(true)} style={{ ...buttonStyle, width: '100%' }}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Bell size={variant === 'sidebar' ? 14 : 18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -3, width: 7, height: 7,
                borderRadius: '50%', background: 'var(--danger)',
              }} />
            )}
          </span>
          {variant === 'sidebar' ? 'Notifications' : 'Alerts'}
        </button>
      </div>

      {open && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 1100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Bell size={16} color="var(--text-3)" />
              <h3 style={{ flex: 1, fontSize: 14 }}>Notifications</h3>
              {unreadCount > 0 && (
                <button className="btn btn-xs btn-ghost" onClick={markAllRead}>Mark all read</button>
              )}
              <button className="btn-icon" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  You're all caught up.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
                  {notifications.map(n => {
                    const meta = TYPE_ICON[n.type] || { icon: Info, color: 'var(--text-3)' }
                    const Icon = meta.icon
                    const isNudge = n.type === 'nudge'
                    return (
                      <div
                        key={n.id}
                        style={{ padding: '10px', borderRadius: 'var(--radius)', background: n.read ? 'transparent' : 'var(--bg-2)', marginBottom: 2 }}
                        onClick={() => handleClick(n)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <Icon size={14} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</p>
                            {n.body && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{n.body}</p>}
                            <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                            {isNudge && n.metadata?.sender_id && user && (
                              <NudgeThread
                                notification={n}
                                currentUserId={user.id}
                                onClose={() => setOpen(false)}
                              />
                            )}
                          </div>
                          {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--career)', flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
