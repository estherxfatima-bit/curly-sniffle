import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush, isSubscribed } from '../lib/pushNotifications'
import { Bell, BellOff, Sun, Moon, LogOut, Calendar, Unlink } from 'lucide-react'

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

  useEffect(() => {
    registerServiceWorker()
    if (!('PushManager' in window)) { setPushSupported(false); return }
    isSubscribed().then(setPushEnabled)
  }, [])

  useEffect(() => {
    if (!user) return
    loadGoogleStatus()
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'error') alert('Failed to connect Google Calendar. Please try again.')
  }, [user])

  async function loadGoogleStatus() {
    const { data } = await supabase.from('google_tokens').select('google_email').eq('user_id', user.id).maybeSingle()
    setGoogleStatus({ loading: false, connected: !!data, email: data?.google_email || null })
  }

  async function disconnectGoogle() {
    await supabase.from('google_tokens').delete().eq('user_id', user.id)
    setGoogleStatus({ loading: false, connected: false, email: null })
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
            {googleStatus.connected ? (
              <button className="btn btn-ghost flex items-center gap-2" onClick={disconnectGoogle} style={{ color: 'var(--danger)' }}>
                <Unlink size={14} />
                Disconnect
              </button>
            ) : (
              <a className="btn btn-accent flex items-center gap-2" style={{ color: '#fff' }} href={`/api/auth/google/start?token=${encodeURIComponent(session?.access_token || '')}`}>
                <Calendar size={14} />
                Connect Google Calendar
              </a>
            )}
          </div>
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
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{user?.user_metadata?.full_name || user?.email}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.email}</p>
          </div>
          <button className="btn btn-ghost flex items-center gap-2" onClick={signOut} style={{ color: 'var(--danger)' }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
