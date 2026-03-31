import { NavLink } from 'react-router-dom'
import {
  BellRing,
  FileBarChart,
  LayoutDashboard,
  Activity,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

const navItems: NavItem[] = [
  { to: '/', label: 'Consumption', icon: LayoutDashboard, end: true },
  { to: '/dashboard', label: 'Monitoring (legacy)', icon: Activity },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
]

export function Sidebar() {
  return (
    <aside
      className={[
        'group hidden shrink-0 flex-col border-r border-[var(--border)] md:flex',
        // Use theme tokens for consistent contrast in light/dark.
        'bg-[var(--card)]',
        'transition-[width] duration-200 ease-in-out',
        'w-[60px] hover:w-[250px]',
      ].join(' ')}
    >
      {/* Brand header */}
      <div className={['border-b border-[var(--border)] p-2', 'group-hover:p-4'].join(' ')}>
        <div className={['flex items-center justify-center', 'group-hover:justify-start group-hover:gap-2'].join(' ')}>
          {/* intentionally empty: icon removed */}
        </div>
      </div>

      {/* Navigation */}
      <nav className={['flex-1 overflow-y-auto p-2', 'group-hover:p-3'].join(' ')}>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-xl text-sm transition',
                    'justify-center px-2 py-2 group-hover:justify-start group-hover:gap-2 group-hover:px-3',
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--primary)_25%,var(--border))]'
                      : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]',
                  ].join(' ')
                }
              >
                <Icon size={16} />
                <span
                  className={[
                    'truncate overflow-hidden transition-all duration-200 ease-in-out',
                    'w-0 opacity-0 group-hover:w-auto group-hover:opacity-100',
                  ].join(' ')}
                >
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="mt-auto hidden border-t border-[var(--border)] p-3 group-hover:block">
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted)]">
            Live data auto-refreshes every 3 seconds.
          </div>
        </div>
    </aside>
  )
}
