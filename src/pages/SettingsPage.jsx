import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../lib/pushNotifications'
import { Bell, BellOff, Sun, Moon, LogOut, Calendar, Unlink, MessageSquare, Clock4, Check, Pencil } from 'lucide-react'

function SettingsDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <circle cx="50" cy="35" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <circle cx="50" cy="35" r="6" fill="currentColor" opacity="0.15"/>
      <circle cx="50" cy="15" r="3" fill="currentColor" opacity="0.2"/>
      <circle cx="50" cy="55" r="3" fill="currentColor" opacity="0.2"/>
      <circle cx="30" cy="25" r="3" fill="currentColor" opacity="0.2"/>
      <circle cx="70" cy="25" r="3" fill="currentColor" opacity="0.2"/>
      <circle cx="30" cy="45" r="3" fill="currentColor" opacity="0.2"/>
      <circle cx="70" cy="45" r="3" fill="currentColor" opacity="0.2"/>
    </svg>
  )
}

export default function SettingsPage() {
  const { user, session, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushSupported, setPushSupported] = useState(true)
  const [googleStatus, setGoogleStatus] = useState({ loading: true, connected: false, email: null })
  const [smsStatus, setSmsStatus] = useState({ loading: true, configured: false, smsNumber: null, examples: [] })
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '19:00' })
  const [workingHoursLoading, setWorkingHoursLoading] = useState(true)
  const [workingHoursSaved, setWorkingHoursSaved] = useState(false)
  const [autoCompleteLinked, setAutoCompleteLinked] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    registerServiceWorker()
    if (!('PushManager' in window)) { setPushSupported(false); return }
    isSubscribed().then(setPushEnabled)
  }, [])

  useEffect(() => {
    if (!user) return
    loadGoogleStatus()
    loadSmsStatus()
    loadWorkingHours()
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'error') alert('Failed to connect Google Calendar. Please try again.')
  }, [user])

  async function loadWorkingHours() {
    const { data } = await supabase.from('user_preferences').select('working_hours_start, working_hours_end, auto_complete_linked_tasks').eq('user_id', user.id).maybeSingle()
    if (data) {
      setWorkingHours({ start: data.working_hours_start, end: data.working_hours_end })
      setAutoCompleteLinked(data.auto_complete_linked_tasks ?? true)
    }
    setWorkingHoursLoading(false)
  }

  async function toggleAutoCompleteLinked() {
    const next = !autoCompleteLinked
    setAutoCompleteLinked(next)
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      auto_complete_linked_tasks: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  async function saveWorkingHours(next) {
    setWorkingHours(next)
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      working_hours_start: next.start,
      working_hours_end: next.end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setWorkingHoursSaved(true)
    setTimeout(() => setWorkingHoursSaved(false), 1500)
  }

  async function loadGoogleStatus() {
    const { data } = await supabase.from('google_tokens').select('google_email').eq('user_id', user.id).maybeSingle()
    setGoogleStatus({ loading: false, connected: !!data, email: data?.google_email || null })
  }

  async function loadSmsStatus() {
    try {
      const res = await fetch('/api/sms/status', {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setSmsStatus({ loading: false, ...data })
    } catch {
      setSmsStatus({ loading: false, configured: false, smsNumber: null, examples: [] })
    }
  }

  async function disconnectGoogle() {
    await supabase.from('google_tokens').delete().eq('user_id', user.id)
    setGoogleStatus({ loading: false, connected: false, email: null })
  }

  async function saveName() {
    const name = nameInput.trim()
    if (!name) return
    setNameSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    setNameSaving(false)
    if (error) { alert(`Failed to save name: ${error.message}`); return }
    setEditingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 1500)
  }

  async function togglePush() {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(user.id)
        setPushEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') { alert('Notification permission denied.'); return }
        await subscribeToPush(user.id)
        setPushEnabled(true)
      }
    } catch (e) {
      alert(`Push setup failed: ${e.message}`)
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div>
          <h1>Settings</h1>
          <p>Theme, notifications, and account</p>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><SettingsDecoration /></div>
      </div>

      {/* Appearance */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Theme</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Currently: {theme === 'dark' ? 'Dark' : 'Light'}</p>
          </div>
          <button className="btn btn-ghost flex items-center gap-2" onClick={toggle}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            Switch to {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>
      </div>

      {/* Push notifications */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Push notifications</h3>
        {!pushSupported ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Push notifications are not supported in this browser.</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>Browser notifications</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {pushEnabled ? 'Enabled — habit reminders and weekly prompts will be delivered.' : 'Disabled — enable to receive habit and planning reminders.'}
              </p>
            </div>
            <button
              className={`btn ${pushEnabled ? 'btn-ghost' : 'btn-accent'} flex items-center gap-2`}
              onClick={togglePush}
              disabled={pushLoading}
              style={!pushEnabled ? { color: '#fff' } : {}}
            >
              {pushEnabled ? <BellOff size={14} /> : <Bell size={14} />}
              {pushLoading ? 'Working…' : pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Google Calendar</h3>
        {googleStatus.loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge ${googleStatus.connected ? 'badge-finance' : 'badge-muted'}`}>
                  {googleStatus.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {googleStatus.connected ? googleStatus.email : 'Connect your Google account to show calendar events on your dashboard and weekly plan.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a className="btn btn-accent flex items-center gap-2" style={{ color: '#fff' }} href={`/api/auth/google/start?token=${encodeURIComponent(session?.access_token || '')}`}>
                <Calendar size={14} />
                {googleStatus.connected ? 'Reconnect' : 'Connect Google Calendar'}
              </a>
              {googleStatus.connected && (
                <button className="btn btn-ghost flex items-center gap-2" onClick={disconnectGoogle} style={{ color: 'var(--danger)' }}>
                  <Unlink size={14} />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
        {!googleStatus.loading && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
            "Time-block my day" needs permission to create events in your calendar.
            {googleStatus.connected ? ' If you connected before this feature was added, click Reconnect to grant write access.' : ''}
          </p>
        )}
      </div>

      {/* Working hours */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Working hours</h3>
        {workingHoursLoading ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>Used for "Time-block my day"</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>To-dos are scheduled into free gaps within these hours.</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock4 size={14} color="var(--text-3)" />
              <input type="time" value={workingHours.start} onChange={e => saveWorkingHours({ ...workingHours, start: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }} />
              <span style={{ color: 'var(--text-3)' }}>–</span>
              <input type="time" value={workingHours.end} onChange={e => saveWorkingHours({ ...workingHours, end: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }} />
              {workingHoursSaved && <span style={{ fontSize: 11, color: 'var(--success)' }}>Saved</span>}
            </div>
          </div>
        )}
      </div>

      {/* Task linking */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Task linking</h3>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Auto-complete linked tasks</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              When you complete a to-do pulled from the weekly plan, also mark that weekly task as done.
            </p>
          </div>
          <button
            className={`btn ${autoCompleteLinked ? 'btn-accent' : 'btn-ghost'} flex items-center gap-2`}
            onClick={toggleAutoCompleteLinked}
            disabled={workingHoursLoading}
            style={autoCompleteLinked ? { color: '#fff' } : {}}
          >
            {autoCompleteLinked ? <Check size={14} /> : null}
            {autoCompleteLinked ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* SMS (Twilio) */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>SMS assistant</h3>
        {smsStatus.loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${smsStatus.configured ? 'badge-finance' : 'badge-muted'}`}>
                    {smsStatus.configured ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {smsStatus.configured
                    ? `Text ${smsStatus.smsNumber} to log expenses, manage to-dos, or ask the AI assistant anything.`
                    : 'Set the TWILIO_* and MY_PHONE_NUMBER environment variables to enable two-way SMS.'}
                </p>
              </div>
              <MessageSquare size={18} color={smsStatus.configured ? 'var(--finance)' : 'var(--text-3)'} />
            </div>
            {smsStatus.configured && (
              <div>
                <p className="mono mb-2" style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Example commands</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {smsStatus.examples.map(ex => (
                    <code key={ex} style={{ fontSize: 12, background: 'var(--bg-3)', padding: '6px 10px', borderRadius: 'var(--radius)', color: 'var(--text-2)' }}>{ex}</code>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* API keys info */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>API configuration</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 13 }}>Claude API key</p>
            <span className={`badge ${import.meta.env.VITE_CLAUDE_API_KEY ? 'badge-finance' : 'badge-muted'}`}>
              {import.meta.env.VITE_CLAUDE_API_KEY ? 'Configured' : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 13 }}>VAPID public key (push)</p>
            <span className={`badge ${import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'badge-finance' : 'badge-muted'}`}>
              {import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'Configured' : 'Not set'}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
          Set these in your <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', padding: '1px 4px', borderRadius: 3 }}>.env</code> file or Vercel environment variables.
        </p>
      </div>

      {/* Account */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Account</h3>
        <div className="flex items-center justify-between mb-4">
          <div style={{ flex: 1 }}>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  style={{ fontSize: 14, maxWidth: 220 }}
                />
                <button className="btn-icon btn" onClick={saveName} disabled={nameSaving}><Check size={14} /></button>
                <button className="btn-icon btn" onClick={() => setEditingName(false)}>✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p style={{ fontSize: 14, fontWeight: 500 }}>{user?.user_metadata?.full_name || user?.email}</p>
                <button
                  className="btn-icon btn-sm"
                  title="Edit name"
                  onClick={() => { setNameInput(user?.user_metadata?.full_name || ''); setEditingName(true) }}
                >
                  <Pencil size={12} />
                </button>
                {nameSaved && <span style={{ fontSize: 11, color: 'var(--success)' }}>Saved</span>}
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{user?.email}</p>
          </div>
          <button className="btn btn-ghost flex items-center gap-2" onClick={signOut} style={{ color: 'var(--danger)' }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Set your name so Life OS can greet you by name across the app.
        </p>
      </div>
    </div>
  )
}
