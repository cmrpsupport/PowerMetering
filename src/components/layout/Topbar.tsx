import { Search, SunMoon, Wifi } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useDevices } from '../../hooks/queries'
import { Badge } from '../ui/Badge'

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Dashboard'
  if (pathname === '/single-line') return 'Single-Line Diagram'
  if (pathname.startsWith('/meters')) return 'Meters'
  if (pathname === '/power-quality') return 'PQ Analysis'
  if (pathname === '/power-quality/harmonics') return 'Harmonics'
  if (pathname === '/power-quality/waveforms') return 'Waveforms'
  if (pathname === '/power-quality/events') return 'PQ Events'
  if (pathname === '/alerts') return 'Active Alarms'
  if (pathname === '/alarms/incidents') return 'Incidents'
  if (pathname === '/alarms/soe') return 'Sequence of Events'
  if (pathname === '/energy') return 'Energy Dashboard'
  if (pathname === '/energy/load-profiles') return 'Load Profiles'
  if (pathname === '/reports') return 'Report Templates'
  if (pathname === '/reports/schedules') return 'Report Schedules'
  if (pathname === '/reports/kpis') return 'KPIs'
  if (pathname === '/analytics/data-browser') return 'Data Browser'
  if (pathname === '/analytics/trends') return 'Trends'
  if (pathname === '/system/devices') return 'Devices'
  if (pathname === '/system/sites') return 'Sites'
  if (pathname === '/system/capacity') return 'Capacity Planning'
  if (pathname === '/settings') return 'Settings'
  return 'Power Monitoring Expert'
}

const roleBadgeColors: Record<string, string> = {
  operator:
    'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/20',
  engineer:
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-500/20',
  manager:
    'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-200 dark:ring-purple-500/20',
  admin:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/20',
}

export function Topbar() {
  const { pathname } = useLocation()
  const title = useMemo(() => titleForPath(pathname), [pathname])
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const role = useUiStore((s) => s.role)

  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const { data: devices } = useDevices()
  const totalDevices = devices?.length ?? 0
  const connectedDevices = devices?.filter((d) => d.status === 'connected').length ?? 0
  const systemUp = totalDevices > 0 ? connectedDevices > 0 : true

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-[var(--text)]">
              Power Monitoring System
            </div>
            <Badge color={systemUp ? 'green' : 'red'}>{systemUp ? 'UP' : 'DOWN'}</Badge>
          </div>
          <div className="truncate text-xs text-[var(--muted)]">
            {title}
          </div>
        </div>

        {/* Connection status */}
        <div className="hidden items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--text)] sm:flex">
          <span
            className={[
              'inline-block h-2 w-2 rounded-full',
              connectedDevices > 0
                ? 'bg-[var(--accent-green)]'
                : 'bg-[var(--accent-red)]',
            ].join(' ')}
          />
          <Wifi size={13} className="text-[var(--muted)]" />
          <span className="font-medium">
            {connectedDevices}/{totalDevices}
          </span>
        </div>

        {/* Role badge */}
        <span
          className={[
            'hidden items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset sm:inline-flex',
            roleBadgeColors[role] ?? roleBadgeColors.operator,
          ].join(' ')}
        >
          {role}
        </span>

        <form
          className="hidden items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow md:flex"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = q.trim()
            if (!trimmed) return
            navigate(`/meters?query=${encodeURIComponent(trimmed)}`)
          }}
        >
          <Search size={16} className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search meters..."
            className="w-56 bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </form>

        <button
          type="button"
          onClick={toggleTheme}
          className="nr-btn-secondary"
        >
          <SunMoon size={16} />
          <span className="hidden sm:inline">Theme</span>
        </button>
      </div>
    </header>
  )
}
