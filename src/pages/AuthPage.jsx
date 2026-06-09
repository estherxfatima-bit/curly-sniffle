import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function AuthPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const colors = isDark ? {
    brand:                  '#5580ff',
    brandAccent:            '#3a63e0',
    inputBackground:        '#1e2530',
    inputBorder:            '#27303d',
    inputText:              '#e6ddd6',
    inputPlaceholder:       '#6e6058',
    messageText:            '#e6ddd6',
    messageBackground:      '#1e2530',
    anchorTextColor:        '#5580ff',
    dividerBackground:      '#27303d',
    defaultButtonBackground:'#1e2530',
    defaultButtonBorder:    '#27303d',
    defaultButtonText:      '#e6ddd6',
    labelText:              '#9a8d84',
  } : {
    brand:                  '#1a4fff',
    brandAccent:            '#1440e0',
    inputBackground:        '#ffffff',
    inputBorder:            '#e8e0d8',
    inputText:              '#2d2520',
    inputPlaceholder:       '#9a8d84',
    messageText:            '#2d2520',
    messageBackground:      '#f2ede8',
    anchorTextColor:        '#1a4fff',
    dividerBackground:      '#e8e0d8',
    defaultButtonBackground:'#f2ede8',
    defaultButtonBorder:    '#e8e0d8',
    defaultButtonText:      '#2d2520',
    labelText:              '#9a8d84',
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

        {/* Brand mark */}
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
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
          <p style={{
            color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Your personal operating system
          </p>
        </div>

        {/* Auth card */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors,
                  fonts: {
                    bodyFontFamily: '"DM Sans", system-ui, sans-serif',
                    labelFontFamily: '"DM Mono", monospace',
                  },
                  space: {
                    buttonPadding: '11px 16px',
                    inputPadding: '10px 13px',
                  },
                  radii: {
                    borderRadiusButton: '8px',
                    inputBorderRadius: '8px',
                  },
                  fontSizes: {
                    baseBodySize: '14px',
                    baseLabelSize: '11px',
                  },
                },
              },
              style: {
                label: {
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontFamily: '"DM Mono", monospace',
                  color: isDark ? '#9a8d84' : '#9a8d84',
                  marginBottom: '6px',
                },
                button: {
                  fontFamily: '"DM Sans", sans-serif',
                  fontWeight: '500',
                  fontSize: '14px',
                },
                anchor: {
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '13px',
                },
                divider: { margin: '20px 0' },
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
