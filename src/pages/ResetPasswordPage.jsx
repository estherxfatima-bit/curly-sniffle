import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Landed on after clicking the "reset your password" link from the email
// sent by supabase.auth.resetPasswordForEmail. Supabase's client picks up
// the recovery token from the URL and creates a session automatically, so
// updateUser({ password }) here updates the signed-in user's password.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function save() {
    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setMsg({ type: 'success', text: 'Password updated. Redirecting…' })
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '2.6rem',
            fontWeight: 700,
            color: 'var(--career)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: '10px',
          }}>
            Life OS
          </h1>
        </div>

        <div className="card">
          <h3 className="mb-4" style={{ fontSize: '1rem' }}>Set a new password</h3>
          <div className="form-group">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
            />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <button
            className="btn btn-career btn-sm"
            onClick={save}
            disabled={saving || !newPassword || !confirmPassword}
          >
            {saving ? 'Saving…' : 'Save new password'}
          </button>
          {msg && (
            <p style={{ marginTop: 10, fontSize: 12, color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
