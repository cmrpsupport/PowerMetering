import { Bell, SunMoon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useNodeRedHealth, usePlcFullSnapshot } from '../../hooks/queries'
import { Badge } from '../ui/Badge'
import urcLogo from '../../assets/urc-logo.svg'

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Consumption'
  if (pathname === '/dashboard') return 'Monitoring'
  if (pathname.startsWith('/meters/')) return 'Meter Detail'
  if (pathname === '/alerts') return 'Alerts'
  if (pathname === '/reports/consumption') return 'Consumption'
  return 'Power Monitoring'
}

export function Topbar() {
  const { pathname } = useLocation()
  const title = useMemo(() => titleForPath(pathname), [pathname])
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  const { data: snap } = usePlcFullSnapshot()
  const { data: health } = useNodeRedHealth()
  // Important: snapshot values can remain cached even when PLC is disconnected.
  // Use the health heartbeat (last communication age) as the source of truth.
  const plcUp = health?.plcLink?.up === true
  const metersOnline = snap?.meters
    ? Object.values(snap.meters).filter(
        (d) => d.Real_power !== 0 || d.Voltage_Lave !== 0 || d.Current_Ave !== 0,
      ).length
    : 0

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/75 backdrop-blur">
      <div className="w-full px-4 sm:px-6">
        <div className="flex min-h-[60px] w-full items-center justify-between gap-4">
          {/* LEFT: Logo + App title */}
          <div className="flex min-w-0 items-center gap-3">
            <img src={urcLogo} alt="URC" className="h-8 w-auto shrink-0" />
          </div>

          {/* CENTER: Status (optional) */}
          <div className="hidden flex-1 items-center justify-center gap-3 md:flex">
            <div className="truncate text-sm font-medium text-[var(--muted)]">{title}</div>
            <Badge color={plcUp ? 'green' : 'red'}>{plcUp ? 'PLC Connected' : 'PLC Disconnected'}</Badge>
          </div>

          {/* RIGHT: Actions + User profile */}
          <div className="flex shrink-0 items-center justify-end gap-3">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]"
              aria-label="Toggle theme"
            >
              <SunMoon size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--text)] shadow-sm">
                TJ
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-semibold text-[var(--text)]">TJC</div>
                <div className="text-xs text-[var(--muted)]">Operator</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: stacked status row (prevents overlap) */}
        <div className="border-t border-[var(--border)] py-2 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm font-medium text-[var(--muted)]">{title}</div>
            <Badge color={plcUp ? 'green' : 'red'}>{plcUp ? 'PLC Connected' : 'PLC Disconnected'}</Badge>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {metersOnline} meter{metersOnline !== 1 ? 's' : ''} reporting
          </div>
        </div>
      </div>
    </header>
  )
}
