import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Bell, X, MessageSquare, Flame, CalendarDays, Info, Sun, Moon, ListTodo, Users, ClipboardList } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
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

export default function NotificationsBell({ variant = 'sidebar' }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  useLockBodyScroll(open)
  const navigate = useNavigate()

  function handleClick(n) {
    if (!n.read) markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
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

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  You're all caught up.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
                  {notifications.map(n => {
                    const meta = TYPE_ICON[n.type] || { icon: Info, color: 'var(--text-3)' }
                    const Icon = meta.icon
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px', borderRadius: 'var(--radius)', background: n.read ? 'transparent' : 'var(--bg-2)', textAlign: 'left', width: '100%' }}
                      >
                        <Icon size={14} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</p>
                          {n.body && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{n.body}</p>}
                          <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                        </div>
                        {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--career)', flexShrink: 0, marginTop: 4 }} />}
                      </button>
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
