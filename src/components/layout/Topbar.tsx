import { Bell, SunMoon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useNodeRedHealth, usePlcFullSnapshot } from '../../hooks/queries'
import { Badge } from '../ui/Badge'
import { GIT_SHA } from '../../constants/version'
import urcLogo from '../../assets/urc-logo.svg'

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Consumption'
  if (pathname === '/dashboard') return 'Plant Overview'
  if (pathname === '/dashboard/pvc') return 'PVC Trends'
  if (pathname.startsWith('/dashboard/')) return 'Plant Overview'
  if (pathname === '/real-time-data') return 'Live Meters'
  if (pathname.startsWith('/meters/')) return 'Meter Detail'
  if (pathname === '/alerts') return 'Alarms'
  if (pathname === '/topology') return 'Single Line'
  if (pathname === '/power-quality') return 'PQ Trends'
  if (pathname === '/power-quality/trends') return 'PQ Trends'
  if (pathname === '/power-quality/events') return 'PQ Events'
  if (pathname.startsWith('/power-quality/')) return 'Power Quality'
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
          </div>

          {/* RIGHT: Actions + User profile */}
          <div className="flex shrink-0 items-center justify-end gap-3">
            <div className="hidden items-center gap-2 text-xs text-[var(--muted)] lg:flex">
              <span>Communication</span>
              <span className="relative inline-flex h-2.5 w-2.5">
                <span
                  className={[
                    'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
                    plcUp ? 'bg-emerald-400' : 'bg-red-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span
                  className={['relative inline-flex h-2.5 w-2.5 rounded-full', plcUp ? 'bg-emerald-400' : 'bg-red-400'].join(' ')}
                  title={plcUp ? 'Communication heartbeat: connected' : 'Communication heartbeat: disconnected'}
                  aria-label={plcUp ? 'Communication heartbeat: connected' : 'Communication heartbeat: disconnected'}
                />
              </span>
              <span className={plcUp ? 'text-emerald-400' : 'text-red-400'}>{plcUp ? 'Connected' : 'Disconnected'}</span>
            </div>
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
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-[var(--muted)]"
                title={`Git commit ${GIT_SHA}`}
              >
                {GIT_SHA}
              </span>
              <span className="text-[11px] text-[var(--muted)]">Comm:</span>
              <span className="relative inline-flex h-2.5 w-2.5">
                <span
                  className={[
                    'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
                    plcUp ? 'bg-emerald-400' : 'bg-red-400',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span
                  className={['relative inline-flex h-2.5 w-2.5 rounded-full', plcUp ? 'bg-emerald-400' : 'bg-red-400'].join(' ')}
                  title={plcUp ? 'Communication heartbeat: connected' : 'Communication heartbeat: disconnected'}
                  aria-label={plcUp ? 'Communication heartbeat: connected' : 'Communication heartbeat: disconnected'}
                />
              </span>
              <span className={['text-[11px] font-medium', plcUp ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                {plcUp ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {metersOnline} meter{metersOnline !== 1 ? 's' : ''} reporting
          </div>
        </div>
      </div>
    </header>
  )
}
