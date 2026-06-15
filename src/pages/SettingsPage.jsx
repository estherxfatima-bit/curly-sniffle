import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../lib/pushNotifications'
import { Bell, BellOff, Sun, Moon, LogOut, Calendar, Unlink, MessageSquare, Clock4, Check } from 'lucide-react'

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
  const [reflection, setReflection] = useState({ enabled: false, time: '20:00', method: 'push' })
  const [personalContext, setPersonalContext] = useState('')
  const [personalContextSaving, setPersonalContextSaving] = useState(false)
  const [personalContextSaved, setPersonalContextSaved] = useState(false)

  // Account: change display name
  const [displayName, setDisplayName] = useState('')
  const [displayNameSaving, setDisplayNameSaving] = useState(false)
  const [displayNameMsg, setDisplayNameMsg] = useState(null)

  // Account: change email
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  // Account: change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState(null)

  // Account: send password reset email
  const [resetSending, setResetSending] = useState(false)
  const [resetMsg, setResetMsg] = useState(null)

  // Sharing with partners
  const [sharingSettings, setSharingSettings] = useState({ share_finance: false, share_wellness: false, share_books: false })

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
    loadPersonalContext()
    loadDisplayName()
    loadSharingSettings()
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'error') alert('Failed to connect Google Calendar. Please try again.')
  }, [user])

  async function loadDisplayName() {
    const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    setDisplayName(data?.display_name || user?.user_metadata?.full_name || '')
  }

  async function loadSharingSettings() {
    const { data } = await supabase.from('user_sharing_settings')
      .select('share_finance, share_wellness, share_books').eq('user_id', user.id).maybeSingle()
    if (data) setSharingSettings(data)
  }

  async function toggleSharing(field) {
    const next = { ...sharingSettings, [field]: !sharingSettings[field] }
    setSharingSettings(next)
    await supabase.from('user_sharing_settings').upsert({
      user_id: user.id,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  async function loadPersonalContext() {
    const { data } = await supabase.from('profiles').select('personal_context').eq('id', user.id).maybeSingle()
    setPersonalContext(data?.personal_context || '')
  }

  async function savePersonalContext() {
    setPersonalContextSaving(true)
    await supabase.from('profiles').upsert({ id: user.id, email: user.email, personal_context: personalContext }, { onConflict: 'id' })
    setPersonalContextSaving(false)
    setPersonalContextSaved(true)
    setTimeout(() => setPersonalContextSaved(false), 1500)
  }

  async function loadWorkingHours() {
    const { data } = await supabase.from('user_preferences')
      .select('working_hours_start, working_hours_end, auto_complete_linked_tasks, reflection_enabled, reflection_time, reflection_method')
      .eq('user_id', user.id).maybeSingle()
    if (data) {
      setWorkingHours({ start: data.working_hours_start, end: data.working_hours_end })
      setAutoCompleteLinked(data.auto_complete_linked_tasks ?? true)
      setReflection({
        enabled: data.reflection_enabled ?? false,
        time: data.reflection_time || '20:00',
        method: data.reflection_method || 'push',
      })
    }
    setWorkingHoursLoading(false)
  }

  async function saveReflection(next) {
    setReflection(next)
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      reflection_enabled: next.enabled,
      reflection_time: next.time,
      reflection_method: next.method,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
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

  async function saveDisplayName() {
    const name = displayName.trim()
    if (!name) return
    setDisplayNameSaving(true)
    setDisplayNameMsg(null)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, display_name: name }, { onConflict: 'id' })
    if (!error) await supabase.auth.updateUser({ data: { full_name: name } })
    setDisplayNameSaving(false)
    setDisplayNameMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Saved' })
  }

  async function saveEmail() {
    if (!newEmail.trim() || !emailPassword) return
    setEmailSaving(true)
    setEmailMsg(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: emailPassword })
    if (authError) {
      setEmailSaving(false)
      setEmailMsg({ type: 'error', text: 'Incorrect password.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ type: 'error', text: error.message })
    } else {
      setEmailMsg({ type: 'success', text: 'Check your new email to confirm the change.' })
      setNewEmail('')
      setEmailPassword('')
    }
  }

  async function savePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    setPasswordSaving(true)
    setPasswordMsg(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (authError) {
      setPasswordSaving(false)
      setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'success', text: 'Password updated.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function sendPasswordReset() {
    setResetSending(true)
    setResetMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    setResetMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Reset email sent — check your inbox.' })
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

      {/* Daily reflection */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Daily reflection</h3>
        {workingHoursLoading ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Evening reflection nudge</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Get reminded to reflect on your day and set tomorrow's priorities.
                </p>
              </div>
              <button
                className={`btn ${reflection.enabled ? 'btn-accent' : 'btn-ghost'} flex items-center gap-2`}
                onClick={() => saveReflection({ ...reflection, enabled: !reflection.enabled })}
                style={reflection.enabled ? { color: '#fff' } : {}}
              >
                {reflection.enabled ? <Check size={14} /> : null}
                {reflection.enabled ? 'On' : 'Off'}
              </button>
            </div>
            {reflection.enabled && (
              <div className="flex items-center gap-4 wrap">
                <div className="flex items-center gap-2">
                  <Clock4 size={14} color="var(--text-3)" />
                  <input type="time" value={reflection.time} onChange={e => saveReflection({ ...reflection, time: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>via</span>
                  <select value={reflection.method} onChange={e => saveReflection({ ...reflection, method: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }}>
                    <option value="push">Push notification</option>
                    <option value="sms">SMS</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
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

      {/* Sharing with partners */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>Sharing with partners</h3>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
          Accepted accountability partners can always see your Goals, Insights, Weekly todos and Daily todos
          (unless you mark an individual item private with its lock icon). The sections below are off by default —
          when turned on, partners see a summary only, never your raw entries or amounts.
        </p>
        {[
          { field: 'share_finance', label: 'Finance', desc: 'Shows budget adherence % only — never your income, expenses or amounts.' },
          { field: 'share_wellness', label: 'Wellness', desc: 'Shows your 7-day average sleep and hydration only.' },
          { field: 'share_books', label: 'Books', desc: 'Shows how many books you\'re reading and finished this quarter.' },
        ].map(({ field, label, desc }) => (
          <div key={field} className="flex items-center justify-between" style={{ paddingTop: 10, paddingBottom: 10, borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</p>
            </div>
            <button
              className={`btn ${sharingSettings[field] ? 'btn-accent' : 'btn-ghost'} flex items-center gap-2`}
              onClick={() => toggleSharing(field)}
              style={sharingSettings[field] ? { color: '#fff' } : {}}
            >
              {sharingSettings[field] ? <Check size={14} /> : null}
              {sharingSettings[field] ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>

      {/* AI context */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>My context</h3>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
          Tell the AI about you
        </p>
        <textarea
          value={personalContext}
          onChange={e => setPersonalContext(e.target.value)}
          placeholder="Your work, goals, what you're building, how you like to be challenged…"
          style={{ minHeight: 120, fontSize: 13, width: '100%' }}
        />
        <div className="flex items-center gap-2 mt-2">
          <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={savePersonalContext} disabled={personalContextSaving}>
            {personalContextSaving ? 'Saving…' : 'Save'}
          </button>
          {personalContextSaved && <span style={{ fontSize: 11, color: 'var(--success)' }}>Saved</span>}
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: '0.9rem' }}>Account</h3>
          <button className="btn btn-ghost flex items-center gap-2" onClick={signOut} style={{ color: 'var(--danger)' }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {/* Display name */}
        <div className="form-group">
          <label>Display name</label>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
            Used to greet you across the app. Currently signed in as {user?.email}.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={{ fontSize: 13, maxWidth: 240 }}
            />
            <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={saveDisplayName} disabled={displayNameSaving || !displayName.trim()}>
              {displayNameSaving ? 'Saving…' : 'Save'}
            </button>
            {displayNameMsg && (
              <span style={{ fontSize: 11, color: displayNameMsg.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>{displayNameMsg.text}</span>
            )}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />

        {/* Change email */}
        <div className="form-group">
          <label>Change email</label>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
            We'll send a confirmation link to the new address before the change takes effect.
          </p>
          <div className="flex items-center gap-2 wrap">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="New email address"
              style={{ fontSize: 13, maxWidth: 220 }}
            />
            <input
              type="password"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              placeholder="Current password"
              style={{ fontSize: 13, maxWidth: 160 }}
            />
            <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={saveEmail} disabled={emailSaving || !newEmail.trim() || !emailPassword}>
              {emailSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {emailMsg && (
            <p style={{ fontSize: 11, color: emailMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', marginTop: 6 }}>{emailMsg.text}</p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />

        {/* Change password */}
        <div className="form-group">
          <label>Change password</label>
          <div className="flex items-center gap-2 wrap mb-2">
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              style={{ fontSize: 13, maxWidth: 160 }}
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              style={{ fontSize: 13, maxWidth: 160 }}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ fontSize: 13, maxWidth: 160 }}
            />
            <button
              className="btn btn-career btn-sm"
              style={{ color: '#fff' }}
              onClick={savePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            >
              {passwordSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {passwordMsg && (
            <p style={{ fontSize: 11, color: passwordMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', marginBottom: 10 }}>{passwordMsg.text}</p>
          )}

          <button className="btn btn-ghost btn-sm" onClick={sendPasswordReset} disabled={resetSending}>
            {resetSending ? 'Sending…' : 'Send password reset email'}
          </button>
          {resetMsg && (
            <p style={{ fontSize: 11, color: resetMsg.type === 'error' ? 'var(--danger)' : 'var(--success)', marginTop: 6 }}>{resetMsg.text}</p>
          )}
        </div>
      </div>
    </div>
  )
}
