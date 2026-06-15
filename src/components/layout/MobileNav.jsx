import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Film, Heart, MoreHorizontal, Search } from 'lucide-react'
import { useState } from 'react'
import NotificationsBell from './NotificationsBell'

// Phase 7: primary 4 tabs — Dashboard, Week, Content, Wellness
const primaryItems = [
  { to: '/',         label: 'Home',     icon: LayoutDashboard },
  { to: '/weekly',   label: 'Week',     icon: CalendarDays    },
  { to: '/content',  label: 'Content',  icon: Film            },
  { to: '/wellness', label: 'Wellness', icon: Heart           },
]

const overflowItems = [
  { to: '/goals',    label: 'Goals'    },
  { to: '/habits',   label: 'Habits'   },
  { to: '/finance',  label: 'Finance'  },
  { to: '/insights', label: 'Insights' },
  { to: '/partners', label: 'Partners' },
  { to: '/ai-log',   label: 'AI Log'   },
  { to: '/settings', label: 'Settings' },
]

export default function MobileNav({ onOpenSearch }) {
  const [showOverflow, setShowOverflow] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      {showOverflow && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 89 }} onClick={() => setShowOverflow(false)} />
      )}

      {showOverflow && (
        <div className="mobile-more-sheet" style={{
          position: 'fixed', bottom: 72, right: 12,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px',
          zIndex: 90,
          minWidth: 160,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div className="mobile-more-handle" />
          {overflowItems.map(item => (
            <button
              key={item.to}
              onClick={() => { navigate(item.to); setShowOverflow(false) }}
              style={{
                display: 'block', width: '100%', padding: '11px 16px',
                background: 'transparent', color: 'var(--text-2)',
                fontSize: '14px', textAlign: 'left',
                borderRadius: 'var(--radius)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 60,
        background: 'var(--card-bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        zIndex: 80,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 -1px 16px rgba(45,37,32,0.06)',
      }}>
        {primaryItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '3px', padding: '8px 0',
              color: isActive ? 'var(--career)' : 'var(--text-3)',
              textDecoration: 'none',
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        <button
          onClick={onOpenSearch}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '3px', padding: '8px 0',
            background: 'transparent',
            color: 'var(--text-3)',
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}
        >
          <Search size={18} />
          Search
        </button>

        <NotificationsBell variant="mobile" />

        <button
          onClick={() => setShowOverflow(v => !v)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: '3px', padding: '8px 0',
            background: 'transparent',
            color: showOverflow ? 'var(--career)' : 'var(--text-3)',
            fontSize: '10px', fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}
        >
          <MoreHorizontal size={18} />
          More
        </button>
      </nav>
    </>
  )
}
