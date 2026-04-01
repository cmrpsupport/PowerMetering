import { Link } from 'react-router-dom'
import { StatCard } from '../components/ui/StatCard'

type HubCard = {
  title: string
  desc: string
  to: string
  cta: string
}

const CARDS: HubCard[] = [
  {
    title: 'Real Time Data',
    desc: 'All 25 meters live from DB16. Filter, scan, and click-through to meter detail.',
    to: '/real-time-data',
    cta: 'Open real time table',
  },
  {
    title: 'PVC Trends',
    desc: 'Power / Voltage / Current shaded trends with navigator and brush controls.',
    to: '/dashboard/pvc',
    cta: 'Open PVC trends',
  },
  {
    title: 'Electrical Topology',
    desc: 'SCADA-style hierarchy view of Main Line, utilities, and production feeders with drilldown.',
    to: '/topology',
    cta: 'Open topology',
  },
  {
    title: 'Power Quality (SCADA)',
    desc: 'Single-screen PQ trends (V, Hz, PF, kW/kVAR).',
    to: '/power-quality',
    cta: 'Open PQ SCADA',
  },
  {
    title: 'Power Quality Events',
    desc: 'Voltage sags/swells/interruptions timeline and event table for investigation.',
    to: '/power-quality/events',
    cta: 'Open events',
  },
  {
    title: 'Dashboard (legacy analytics)',
    desc: 'Full scrollable dashboard with deep analytics panels (load profile, peak demand, etc.).',
    to: '/dashboard/legacy',
    cta: 'Open legacy dashboard',
  },
]

export function DashboardDetailsPage() {
  return (
    <div className="grid h-[calc(100vh-124px)] min-h-0 grid-rows-[auto_auto_1fr] gap-3 overflow-hidden">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Dashboard Details</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            No-scroll hub. Open a drill-down page below.
          </div>
        </div>
        <div className="text-xs text-[var(--muted)]">
          Tip: operators should use <span className="text-[var(--text)]">Dashboard (SCADA)</span> for the live overview.
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="SCADA Overview" value="Dashboard" right={<Link className="text-xs text-[var(--primary)] hover:underline" to="/dashboard">Open</Link>} />
        <StatCard title="Live Meters" value="DB16" right={<Link className="text-xs text-[var(--primary)] hover:underline" to="/real-time-data">Open</Link>} />
        <StatCard title="Topology" value="Hierarchy" right={<Link className="text-xs text-[var(--primary)] hover:underline" to="/topology">Open</Link>} />
        <StatCard title="Power Quality" value="Trends + Events" right={<Link className="text-xs text-[var(--primary)] hover:underline" to="/power-quality">Open</Link>} />
      </div>

      <div className="grid min-h-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.to} className="card card-hover flex min-h-0 flex-col p-5">
            <div className="text-sm font-semibold text-[var(--text)]">{c.title}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{c.desc}</div>
            <div className="mt-auto pt-4">
              <Link
                to={c.to}
                className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] px-3 py-2 text-xs font-medium text-[var(--primary)] hover:opacity-90"
              >
                {c.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

