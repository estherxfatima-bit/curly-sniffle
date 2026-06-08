import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
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
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-serif)', color: 'var(--accent)', marginBottom: '8px' }}>
            Life OS
          </h1>
          <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Your personal operating system
          </p>
        </div>

        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
        }}>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#3b7bff',
                    brandAccent: '#2a5fd4',
                    inputBackground: '#221f1b',
                    inputBorder: '#2e2a25',
                    inputText: '#e8e0d5',
                    inputPlaceholder: '#7a6f63',
                    messageText: '#e8e0d5',
                    messageBackground: '#221f1b',
                    anchorTextColor: '#c8a97e',
                    dividerBackground: '#2e2a25',
                    defaultButtonBackground: '#221f1b',
                    defaultButtonBorder: '#2e2a25',
                    defaultButtonText: '#e8e0d5',
                  },
                  fonts: { bodyFontFamily: 'DM Sans, sans-serif', labelFontFamily: 'DM Sans, sans-serif' },
                  space: { buttonPadding: '10px 16px', inputPadding: '10px 12px' },
                  radii: { borderRadiusButton: '8px', inputBorderRadius: '8px' },
                },
              },
              style: {
                container: { color: '#e8e0d5' },
                label: { color: '#7a6f63', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' },
                button: { fontFamily: 'DM Sans, sans-serif', fontWeight: '500' },
              },
            }}
            providers={['google']}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    </div>
  )
}
