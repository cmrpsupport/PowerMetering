import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Gauge,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useAlerts, useEnhancedAlerts, useMeters, useReadings, useSites, useLatestReading, useEnergyIntervals } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { StatCard } from '../components/ui/StatCard'
import { ProgressBar } from '../components/ui/ProgressBar'
import type { MeterReading, PowerMeter } from '../types'

/* ── helpers ────────────────────────────────────────────── */

function formatKw(n: number) {
  if (!Number.isFinite(n)) return '\u2014'
  return `${n.toFixed(1)} kW`
}

function formatKwh(n: number) {
  if (!Number.isFinite(n)) return '\u2014'
  return `${n.toFixed(1)} kWh`
}

function severityBadgeColor(sev: string): BadgeColor {
  if (sev === 'critical') return 'red'
  if (sev === 'warning') return 'yellow'
  return 'slate'
}

/* ── sub-component: aggregate latest readings across meters ── */

function MeterLatestAggregator({ meters }: { meters: PowerMeter[] }) {
  // Render a component for each meter that calls useLatestReading
  // Collect results via context-free summation
  return (
    <>
      {meters.map((m) => (
        <MeterReadingCollector key={m.id} meterId={m.id} />
      ))}
    </>
  )
}

// Hidden collector that registers its reading into a global ref
// (we'll collect readings differently -- see AggregateStats)
function MeterReadingCollector({ meterId }: { meterId: string }) {
  useLatestReading(meterId) // keep query warm
  return null
}

/* ── main page ──────────────────────────────────────────── */

export function DashboardPage() {
  const metersQ = useMeters()
  const alertsQ = useAlerts()
  const enhancedAlertsQ = useEnhancedAlerts()
  const sitesQ = useSites()

  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data])
  const firstMeterId = meters[0]?.id ?? ''
  const readingsQ = useReadings(firstMeterId, 120)
  const energy24hQ = useEnergyIntervals(24)

  // Fetch latest reading for each meter (up to first 10)
  const m0 = useLatestReading(meters[0]?.id ?? '')
  const m1 = useLatestReading(meters[1]?.id ?? '')
  const m2 = useLatestReading(meters[2]?.id ?? '')
  const m3 = useLatestReading(meters[3]?.id ?? '')
  const m4 = useLatestReading(meters[4]?.id ?? '')
  const m5 = useLatestReading(meters[5]?.id ?? '')
  const m6 = useLatestReading(meters[6]?.id ?? '')
  const m7 = useLatestReading(meters[7]?.id ?? '')
  const m8 = useLatestReading(meters[8]?.id ?? '')
  const m9 = useLatestReading(meters[9]?.id ?? '')

  const latestByIdx: Array<MeterReading | null | undefined> = [
    m0.data,
    m1.data,
    m2.data,
    m3.data,
    m4.data,
    m5.data,
    m6.data,
    m7.data,
    m8.data,
    m9.data,
  ]

  const latestReadings = latestByIdx.filter(Boolean) as MeterReading[]

  const stats = (() => {
    const online = meters.filter((m) => m.status === 'online').length
    const totalPower = latestReadings.reduce((sum, r) => sum + (r?.powerKw ?? 0), 0)
    const totalEnergy = latestReadings.reduce((sum, r) => sum + (r?.energyKwh ?? 0), 0)
    const peakDemand = latestReadings.reduce((max, r) => Math.max(max, r?.powerKw ?? 0), 0)
    const avgPf =
      latestReadings.length > 0
        ? latestReadings.reduce((sum, r) => sum + (r?.pf ?? 0), 0) / latestReadings.length
        : NaN
    const activeAlarms = (alertsQ.data ?? []).filter((a) => !a.acknowledged).length

    return {
      totalPower,
      totalEnergy,
      peakDemand,
      avgPf,
      activeAlarms,
      metersOnline: online,
      total: meters.length,
    }
  })()

  const systemUp = stats.total > 0 ? stats.metersOnline === stats.total && stats.activeAlarms === 0 : true
  const lastCommTs = (() => {
    const candidates: string[] = []
    for (const r of latestReadings) candidates.push(r.ts)
    for (const m of meters) candidates.push(m.lastSeenAt)
    const max = candidates
      .map((t) => new Date(t).getTime())
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)[0]
    return Number.isFinite(max) ? new Date(max).toLocaleString() : '—'
  })()
  const uptimePct = stats.total > 0 ? (stats.metersOnline / stats.total) * 100 : 0

  // Daily consumption per meter (sum of energy intervals over last 24h)
  const dailyConsumptionByMeter = useMemo(() => {
    const intervals = energy24hQ.data ?? []
    const byMeter = new Map<string, { meterId: string; meterName: string; kwh: number }>()
    for (const iv of intervals) {
      const prev = byMeter.get(iv.meterId) ?? {
        meterId: iv.meterId,
        meterName: iv.meterName,
        kwh: 0,
      }
      prev.kwh += iv.energyKwh
      byMeter.set(iv.meterId, prev)
    }

    // Ensure meters with no interval data still appear
    for (const m of meters) {
      if (!byMeter.has(m.id)) {
        byMeter.set(m.id, { meterId: m.id, meterName: m.name, kwh: 0 })
      }
    }

    return Array.from(byMeter.values()).sort((a, b) => b.kwh - a.kwh)
  }, [energy24hQ.data, meters])

  /* latest enhanced alerts (top 5) */
  const topAlerts = useMemo(
    () =>
      [...(enhancedAlertsQ.data ?? [])]
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, 5),
    [enhancedAlertsQ.data],
  )

  /* site summaries */
  const siteSummaries = useMemo(() => {
    const sites = sitesQ.data ?? []
    return sites.map((s) => {
      const siteMeters = meters.filter((m) => s.meterIds.includes(m.id))
      const onlineCount = siteMeters.filter((m) => m.status === 'online').length
      return { ...s, meterCount: siteMeters.length, onlineCount }
    })
  }, [sitesQ.data, meters])

  return (
    <div className="space-y-4">
      {/* Keep latest-reading queries warm */}
      <MeterLatestAggregator meters={meters.slice(10)} />

      {/* Dense SCADA-style grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* System Status (wide) */}
        <div className="card p-4 lg:col-span-2">
          <div className="text-xs font-medium text-slate-400">System Status</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-4xl font-semibold tracking-tight text-[var(--text)]">
              {systemUp ? 'UP' : 'DOWN'}
            </div>
            <div className="shrink-0">
              <Badge color={systemUp ? 'green' : 'red'}>{systemUp ? 'UP' : 'DOWN'}</Badge>
            </div>
          </div>
          <div className="mt-3 text-sm text-[var(--muted)]">
            Last communication: <span className="font-medium text-[var(--text)]">{lastCommTs}</span>
          </div>
          <div className="mt-4">
            <ProgressBar
              value={uptimePct}
              color={systemUp ? 'emerald' : 'rose'}
              label="Uptime %"
            />
          </div>
        </div>

        {/* Power / PLC Data (wide) */}
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-400">Power / PLC Data</div>
              <div className="mt-1 text-sm text-slate-300">Existing live values, styled.</div>
            </div>
            <div className="flex gap-2">
              <Link to="/meters" className="nr-btn-primary">
                View meters
              </Link>
              <Link to="/alerts" className="nr-btn-secondary">
                View alarms
              </Link>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Power" value={formatKw(stats.totalPower)} right={<Zap className="h-4 w-4 text-[var(--accent-green)]" />} />
            <StatCard title="Energy Today" value={formatKwh(stats.totalEnergy)} right={<TrendingUp className="h-4 w-4 text-[var(--accent-green)]" />} />
            <StatCard title="Peak Demand" value={formatKw(stats.peakDemand)} right={<Activity className="h-4 w-4 text-[var(--accent-green)]" />} />
            <StatCard title="Avg PF" value={Number.isFinite(stats.avgPf) ? stats.avgPf.toFixed(3) : '—'} right={<Gauge className="h-4 w-4 text-[var(--accent-green)]" />} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Meters:</span>
            <Badge color={stats.metersOnline === stats.total ? 'green' : 'red'}>
              {stats.metersOnline === stats.total ? 'UP' : 'DOWN'}
            </Badge>
            <span className="text-[var(--muted)]">
              {stats.metersOnline}/{stats.total} online
            </span>
          </div>
        </div>

        {/* Trend graph (wide 3 cols on large) */}
        <div className="card p-4 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)]">
                Trend (Power, last 2h)
              </div>
              <div className="text-xs text-[var(--muted)]">
                {firstMeterId ? `Meter: ${firstMeterId}` : 'Loading meters\u2026'}
              </div>
            </div>
            <div className="text-xs text-[var(--muted)]">
              Auto-refresh: 10s
            </div>
          </div>

          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={readingsQ.data ?? []}
                margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pm_power" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-700/60" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                  minTickGap={36}
                />
                <YAxis tickFormatter={(v) => `${v}`} width={40} />
                <Tooltip
                  labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                  formatter={(value) => [formatKw(Number(value)), 'Power']}
                />
                <Area
                  type="monotone"
                  dataKey="powerKw"
                  stroke="var(--accent-green)"
                  fill="url(#pm_power)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alarm / Fault (dense, red highlight) */}
        <div className="card p-4 lg:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-[var(--muted)]">Alarms / Faults</div>
            <Badge color={stats.activeAlarms > 0 ? 'red' : 'green'}>
              {stats.activeAlarms > 0 ? 'DOWN' : 'UP'}
            </Badge>
          </div>
          <div
            className={
              stats.activeAlarms > 0
                ? 'mt-3 rounded-[10px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent-red)_12%,var(--card))] p-3 text-sm text-[var(--text)]'
                : 'mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)]'
            }
          >
            Active alarms: <span className="font-semibold">{stats.activeAlarms}</span>
          </div>
        </div>

        {/* Latest Alerts table (full width) */}
        <div className="card overflow-hidden lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">Latest Alerts</div>
            <Link to="/alerts" className="text-xs font-medium text-[var(--accent-green)] hover:opacity-90">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--muted)]">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Meter</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Message</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {topAlerts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                      No alerts
                    </td>
                  </tr>
                )}
                {topAlerts.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-[var(--muted)]">
                      {new Date(a.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-[var(--text)]">{a.meterName}</td>
                    <td className="px-4 py-2">
                      <Badge color={severityBadgeColor(a.severity)}>{a.severity}</Badge>
                    </td>
                    <td className="max-w-[44rem] truncate px-4 py-2 text-[var(--text)]">
                      {a.message}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        color={
                          a.status === 'active'
                            ? 'red'
                            : a.status === 'acknowledged'
                              ? 'yellow'
                              : 'green'
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily consumption (all power meters) */}
        <div className="card p-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">
                Daily Consumption by Power Meter
              </div>
              <div className="text-xs text-[var(--muted)]">
                Last 24h aggregated kWh for all meters
              </div>
            </div>
            <div className="text-xs text-[var(--muted)]">
              {energy24hQ.isLoading ? 'Loading…' : `${dailyConsumptionByMeter.length} meters`}
            </div>
          </div>

          <div className="mt-3 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyConsumptionByMeter}
                margin={{ left: 8, right: 12, top: 8, bottom: 52 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-700/60" />
                <XAxis
                  dataKey="meterName"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={64}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}`} width={56} />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(2)} kWh`, String(name)]}
                  labelFormatter={(label) => String(label)}
                />
                <Bar
                  dataKey="kwh"
                  name="Daily Consumption"
                  fill="var(--accent-green)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Site summary cards */}
      {siteSummaries.length > 0 && (
        <div>
          <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            Sites
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {siteSummaries.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {s.name}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {s.address}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge color="indigo">{s.meterCount} meters</Badge>
                  <Badge color={s.onlineCount === s.meterCount ? 'green' : 'yellow'}>
                    {s.onlineCount} online
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
