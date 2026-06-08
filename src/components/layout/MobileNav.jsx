import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, CheckSquare, Film, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

// Max 4 primary items in mobile tab bar — everything else in overflow
const primaryItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/weekly', label: 'Week', icon: CalendarDays },
  { to: '/habits', label: 'Habits', icon: CheckSquare },
  { to: '/content', label: 'Content', icon: Film },
]

const overflowItems = [
  { to: '/goals', label: 'Goals' },
  { to: '/insights', label: 'Insights' },
  { to: '/partners', label: 'Partners' },
]

export default function MobileNav() {
  const [showOverflow, setShowOverflow] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      {showOverflow && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 89 }}
          onClick={() => setShowOverflow(false)}
        />
      )}

      {showOverflow && (
        <div style={{
          position: 'fixed',
          bottom: '72px',
          right: '12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px',
          zIndex: 90,
          minWidth: '160px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {overflowItems.map(item => (
            <button
              key={item.to}
              onClick={() => { navigate(item.to); setShowOverflow(false) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: '13px',
                textAlign: 'left',
                borderRadius: 'var(--radius)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 80,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {primaryItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '8px 0',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
              textDecoration: 'none',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {/* More overflow */}
        <button
          onClick={() => setShowOverflow(v => !v)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            padding: '8px 0',
            background: 'transparent',
            color: showOverflow ? 'var(--accent)' : 'var(--text-3)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          <MoreHorizontal size={18} />
          More
        </button>
      </nav>
    </>
  )
}
