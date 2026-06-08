import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Target, CheckSquare, Film, TrendingUp, Users, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/weekly', label: 'Weekly Plan', icon: CalendarDays },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/habits', label: 'Habits', icon: CheckSquare },
  { to: '/content', label: 'Content', icon: Film },
  { to: '/insights', label: 'Insights', icon: TrendingUp },
  { to: '/partners', label: 'Partners', icon: Users },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      flexShrink: 0,
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--accent)' }}>
          Life OS
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              fontWeight: isActive ? '500' : '400',
              color: isActive ? 'var(--text)' : 'var(--text-3)',
              background: isActive ? 'var(--bg-3)' : 'transparent',
              textDecoration: 'none',
              marginBottom: '2px',
              transition: 'all 0.12s',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User / sign out */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '8px 12px', marginBottom: '4px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '500' }}>
            {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </p>
        </div>
        <button
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--text-3)',
            fontSize: '13px',
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
