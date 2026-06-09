import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Target, CheckSquare, Film,
  TrendingUp, Users, LogOut, Sun, Moon, Sparkles, PiggyBank,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

const navItems = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard, section: 'career'   },
  { to: '/weekly',    label: 'Weekly Plan', icon: CalendarDays,    section: 'career'   },
  { to: '/goals',     label: 'Goals',       icon: Target,          section: 'career'   },
  { to: '/habits',    label: 'Habits',      icon: CheckSquare,     section: 'personal' },
  { to: '/content',   label: 'Content',     icon: Film,            section: 'creative' },
  { to: '/insights',  label: 'Insights',    icon: TrendingUp,      section: 'career'   },
  { to: '/finance',   label: 'Finance',     icon: PiggyBank,       section: 'finance'  },
  { to: '/partners',  label: 'Partners',    icon: Users,           section: 'personal' },
  { to: '/ai-log',   label: 'AI Log',      icon: Sparkles,        section: 'career'   },
]

const SECTION_COLORS = {
  career:   'var(--career)',
  creative: 'var(--creative)',
  finance:  'var(--finance)',
  wellness: 'var(--wellness)',
  personal: 'var(--personal)',
}

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      flexShrink: 0,
      background: 'var(--bg-2)',
      borderRight: '1.5px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.35rem',
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            Life OS
          </span>
          <button
            onClick={toggle}
            className="btn-icon btn"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ color: 'var(--text-3)' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon: Icon, section }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 13px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? SECTION_COLORS[section] : 'var(--text-2)',
              background: isActive ? `var(--${section}-tint, var(--bg-3))` : 'transparent',
              textDecoration: 'none',
              marginBottom: '2px',
              transition: 'all 0.12s',
              borderLeft: isActive ? `3px solid ${SECTION_COLORS[section]}` : '3px solid transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} color={isActive ? SECTION_COLORS[section] : 'var(--text-3)'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1.5px solid var(--border)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 13px',
          marginBottom: '6px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--career-tint)',
            color: 'var(--career)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500,
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
              {user?.user_metadata?.full_name || name}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '8px 13px', borderRadius: '10px',
            background: 'transparent', color: 'var(--text-3)', fontSize: '13px',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
