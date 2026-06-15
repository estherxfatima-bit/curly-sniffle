import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Target, CheckSquare, Film,
  TrendingUp, Users, LogOut, Sun, Moon, Sparkles, PiggyBank, Heart, Settings,
  BookOpen, ListChecks, Search,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

const navItems = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard, section: 'career'   },
  { to: '/weekly',    label: 'Weekly',      icon: CalendarDays,    section: 'career'   },
  { to: '/goals',     label: 'Goals',       icon: Target,          section: 'career'   },
  { to: '/habits',    label: 'Habits',      icon: CheckSquare,     section: 'personal' },
  { to: '/content',   label: 'Content',     icon: Film,            section: 'creative' },
  { to: '/finance',   label: 'Finance',     icon: PiggyBank,       section: 'finance'  },
  { to: '/wellness',  label: 'Wellness',    icon: Heart,           section: 'wellness' },
  { to: '/books',     label: 'Books',       icon: BookOpen,        section: 'creative' },
  { to: '/bucket-list', label: 'Bucket List', icon: ListChecks,    section: 'personal' },
  { to: '/insights',  label: 'Insights',    icon: TrendingUp,      section: 'career'   },
  { to: '/partners',  label: 'Partners',    icon: Users,           section: 'personal' },
  { to: '/ai-log',    label: 'AI Log',      icon: Sparkles,        section: 'career'   },
  { to: '/settings',  label: 'Settings',    icon: Settings,        section: 'career'   },
]

const SECTION_COLORS = {
  career:   'var(--career)',
  creative: 'var(--creative)',
  finance:  'var(--finance)',
  wellness: 'var(--wellness)',
  personal: 'var(--personal)',
}

export default function Sidebar({ onOpenSearch }) {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      flexShrink: 0,
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 22px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            Life OS
          </span>
          <button
            onClick={toggle}
            className="btn-icon"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            style={{ color: 'var(--text-3)' }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 10px 0' }}>
        <button
          onClick={onOpenSearch}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 12px', borderRadius: '8px',
            background: 'var(--bg-2)', color: 'var(--text-3)',
            fontSize: '13px', border: '1px solid var(--border)',
          }}
        >
          <Search size={14} />
          Search
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon: Icon, section }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? SECTION_COLORS[section] : 'var(--text-3)',
              background: isActive ? `var(--${section}-dim, var(--bg-3))` : 'transparent',
              textDecoration: 'none',
              marginBottom: '2px',
              transition: 'all 0.12s',
              borderLeft: isActive ? `3px solid ${SECTION_COLORS[section]}` : '3px solid transparent',
              letterSpacing: 0,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={14} color={isActive ? SECTION_COLORS[section] : 'var(--text-3)'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          marginBottom: '4px',
        }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: '50%',
            background: 'var(--career-tint)',
            color: 'var(--career)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 500,
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
              {user?.user_metadata?.full_name || name}
            </p>
            <p style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 0 }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', padding: '8px 12px',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--text-3)',
            fontSize: '13px',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
