import { useMemo, useState } from 'react'
import { useEnergyIntervals, useNodeRedHealth, usePlcFullSnapshot, usePowerTrend } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { StatCard } from '../components/ui/StatCard'
import { DemandTracker } from '../components/ui/DemandTracker'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateTrendByBucket,
  bucketMsForNavigatorFullSpan,
  bucketMsForVisibleSpan,
  downsampleTrendForChart,
  type TrendPoint,
} from '../lib/trendSeries'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

type TrendWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d'

type FluctuationSeverity = 'warning' | 'critical'
type FluctuationMetric = 'kw' | 'voltage' | 'current'

type FluctuationAlert = {
  id: string
  ts: string
  metric: FluctuationMetric
  severity: FluctuationSeverity
  value: number
  prevValue: number
  delta: number
  deltaPct: number | null
}

function severityColor(sev: FluctuationSeverity): BadgeColor {
  return sev === 'critical' ? 'red' : 'yellow'
}

export function DashboardScadaPage() {
  const snapQ = usePlcFullSnapshot()
  const healthQ = useNodeRedHealth()
  const plcUp = healthQ.data?.plcLink?.up === true

  const [trendWindow, setTrendWindow] = useState<TrendWindow>('24h')
  const trendMinutes =
    trendWindow === '1h'
      ? 60
      : trendWindow === '6h'
        ? 6 * 60
        : trendWindow === '12h'
          ? 12 * 60
          : trendWindow === '24h'
            ? 24 * 60
            : trendWindow === '7d'
              ? 7 * 24 * 60
              : 30 * 24 * 60
  const fetchMinutes = trendWindow === '30d' ? 30 * 24 * 60 : 7 * 24 * 60
  const trendQ = usePowerTrend(fetchMinutes)
  const energy24hQ = useEnergyIntervals(24)

  const plantNow = useMemo(() => {
    const meters = snapQ.data?.meters
    if (!meters) return null
    const list = Object.values(meters)
    if (list.length === 0) return null
    const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
    const kw = sum(list.map((m) => m.Real_power))
    const kvar = sum(list.map((m) => m.Reactive_power))
    const amps = sum(list.map((m) => m.Current_Ave))
    const v = list.map((m) => m.Voltage_Lave).filter((x) => Number.isFinite(x) && x > 0)
    const hz = list.map((m) => m.Frequency).filter((x) => Number.isFinite(x) && x > 0)
    const pf = list.map((m) => m.Power_factor).filter((x) => Number.isFinite(x) && x !== 0)
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
    return { kw, kvar, amps, vAvg: avg(v), hzAvg: avg(hz), pfAvg: avg(pf) }
  }, [snapQ.data?.meters])

  const powerTrendFull = useMemo(() => {
    const pts = trendQ.data ?? []
    return pts
      .map((p) => ({
        ts: p.ts,
        kw: p.kw,
        voltageV: (p as unknown as { voltageV?: number }).voltageV ?? 0,
        currentA: (p as unknown as { currentA?: number }).currentA ?? 0,
        pf: p.pf,
        kvar: p.kvar,
      }))
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
  }, [trendQ.data])

  const pvcNavSeries = useMemo(() => {
    if (powerTrendFull.length === 0) return [] as TrendPoint[]
    const t0 = Date.parse(powerTrendFull[0].ts)
    const t1 = Date.parse(powerTrendFull[powerTrendFull.length - 1].ts)
    const span = Math.max(0, t1 - t0)
    const bucketMs = bucketMsForNavigatorFullSpan(span, 1200)
    return aggregateTrendByBucket(
      powerTrendFull.map((p) => ({
        ts: p.ts,
        kw: p.kw,
        voltageV: p.voltageV,
        currentA: p.currentA,
        pf: p.pf,
        kvar: p.kvar,
      })),
      bucketMs,
    )
  }, [powerTrendFull])

  const powerTrendVisible = useMemo(() => {
    if (powerTrendFull.length === 0) return []
    const endMs = Date.now()
    const startMs = endMs - trendMinutes * 60_000
    return powerTrendFull.filter((p) => {
      const t = Date.parse(p.ts)
      return t >= startMs && t <= endMs
    })
  }, [powerTrendFull, trendMinutes])

  const pvcSpanMs = useMemo(() => {
    if (powerTrendVisible.length < 2) return 0
    return Date.parse(powerTrendVisible[powerTrendVisible.length - 1].ts) - Date.parse(powerTrendVisible[0].ts)
  }, [powerTrendVisible])

  const pvcMainSeries = useMemo(() => {
    const pts = powerTrendVisible.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltageV: p.voltageV,
      currentA: p.currentA,
      pf: p.pf,
      kvar: p.kvar,
    }))
    const down = downsampleTrendForChart(pts, pvcSpanMs)
    const bucketMs = bucketMsForVisibleSpan(pvcSpanMs)
    // Ensure tick labels render nicely by keeping a consistent bucket step.
    return aggregateTrendByBucket(down, bucketMs)
  }, [powerTrendVisible, pvcSpanMs])

  const fluctuationAlerts = useMemo<FluctuationAlert[]>(() => {
    const pts = pvcMainSeries
    if (pts.length < 3) return []

    const alerts: FluctuationAlert[] = []
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i]
      const prev = pts[i - 1]
      if (!cur || !prev) continue

      const check = (metric: FluctuationMetric, value: number, prevValue: number) => {
        const denom = Math.max(1e-6, Math.abs(prevValue))
        const delta = value - prevValue
        const deltaPct = Number.isFinite(prevValue) && Math.abs(prevValue) > 1e-6 ? delta / denom : null
        const absPct = deltaPct === null ? 0 : Math.abs(deltaPct)
        const severity: FluctuationSeverity | null = absPct > 0.4 ? 'critical' : absPct > 0.25 ? 'warning' : null
        if (!severity) return
        alerts.push({
          id: `${metric}:${cur.ts}`,
          ts: cur.ts,
          metric,
          severity,
          value,
          prevValue,
          delta,
          deltaPct,
        })
      }

      check('kw', cur.kw, prev.kw)
      check('voltage', cur.voltageV, prev.voltageV)
      check('current', cur.currentA, prev.currentA)
    }

    return alerts
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, 5)
  }, [pvcMainSeries])

  const totalDemandSeries24h = useMemo(() => {
    const ivs = energy24hQ.data ?? []
    const map = new Map<string, { ts: string; demandKw: number }>()
    for (const iv of ivs) {
      const prev = map.get(iv.ts)
      if (!prev) map.set(iv.ts, { ts: iv.ts, demandKw: iv.demandKw })
      else prev.demandKw += iv.demandKw
    }
    return Array.from(map.values()).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
  }, [energy24hQ.data])

  const loadProfile24h = useMemo(() => totalDemandSeries24h.map((r) => ({ ts: r.ts, demandKw: r.demandKw })), [totalDemandSeries24h])

  const loadProfileTick = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="grid h-[calc(100vh-124px)] min-h-0 grid-rows-[auto_auto_1fr] gap-3 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Dashboard (SCADA)</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            Single-screen overview. Use “Dashboard Details” for deeper drill-down.
          </div>
        </div>
        <div className="shrink-0 text-xs text-[var(--muted)]">
          PLC:{' '}
          <span className={plcUp ? 'text-emerald-400' : 'text-red-400'}>{plcUp ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="Plant kW" value={plantNow ? `${fmt(plantNow.kw, 1)} kW` : '—'} />
        <StatCard title="Plant kVAR" value={plantNow ? `${fmt(plantNow.kvar, 1)} kVAR` : '—'} />
        <StatCard title="I avg" value={plantNow ? `${fmt(plantNow.amps, 0)} A` : '—'} />
        <StatCard title="V L-L avg" value={plantNow ? `${fmt(plantNow.vAvg, 0)} V` : '—'} />
        <StatCard title="Hz avg" value={plantNow ? `${fmt(plantNow.hzAvg, 2)} Hz` : '—'} />
        <StatCard title="PF avg" value={plantNow ? fmt(plantNow.pfAvg, 3) : '—'} />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-4">
        <div className="grid min-h-0 gap-3 lg:col-span-3 lg:grid-rows-[1fr_auto]">
          <div className="card card-hover flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">Power / Voltage / Current</div>
                <div className="text-xs text-[var(--muted)]">
                  Shaded trends with navigator. Drag brush to pan/zoom.
                </div>
              </div>
              <SegmentedControl
                value={trendWindow}
                onChange={(id) => setTrendWindow(id as TrendWindow)}
                options={[
                  { id: '1h', label: '1h' },
                  { id: '6h', label: '6h' },
                  { id: '12h', label: '12h' },
                  { id: '24h', label: '24h' },
                  { id: '7d', label: '7d' },
                  { id: '30d', label: '30d' },
                ]}
              />
            </div>

            <div className="min-h-0 flex-1">
              <div className="h-[360px] min-h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pvcMainSeries} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pvc-kw-scada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="pvc-v-scada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="pvc-i-scada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="ts"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                      stroke="var(--chart-axis)"
                      minTickGap={22}
                      tickFormatter={(v) => new Date(String(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" width={56} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" width={56} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--chart-tooltip-bg)',
                        border: `1px solid var(--chart-tooltip-border)`,
                        borderRadius: 8,
                        color: 'var(--chart-tooltip-text)',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
                    <Area yAxisId="left" type="monotone" dataKey="kw" name="kW" stroke="var(--chart-1)" strokeWidth={2} fill="url(#pvc-kw-scada)" dot={false} connectNulls />
                    <Area yAxisId="right" type="monotone" dataKey="voltageV" name="Voltage (V)" stroke="var(--chart-2)" strokeWidth={2} fill="url(#pvc-v-scada)" dot={false} connectNulls />
                    <Area yAxisId="right" type="monotone" dataKey="currentA" name="Current (A)" stroke="var(--chart-3)" strokeWidth={2} fill="url(#pvc-i-scada)" dot={false} connectNulls />
                    {fluctuationAlerts
                      .filter((a) => a.metric === 'kw')
                      .map((a) => (
                        <ReferenceDot key={a.id} x={a.ts} y={a.value} yAxisId="left" r={4} fill="var(--primary)" stroke="none" />
                      ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {pvcNavSeries.length > 0 ? (
                <div className="mt-2 h-16 w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))] p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pvcNavSeries} margin={{ left: 6, right: 10, top: 2, bottom: 2 }}>
                      <defs>
                        <linearGradient id="pvc-nav-scada" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="ts" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" fill="url(#pvc-nav-scada)" dot={false} isAnimationActive={false} />
                      <Brush dataKey="ts" height={18} stroke="var(--primary)" travellerWidth={10} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card card-hover overflow-hidden p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[var(--text)]">24-hour load profile</div>
              <div className="text-[11px] text-[var(--muted)]">Total demand across meters</div>
            </div>
            <div className="h-48 min-h-[160px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loadProfile24h} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lp-scada" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="ts" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" tickFormatter={loadProfileTick} minTickGap={30} />
                  <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" width={56} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      border: `1px solid var(--chart-tooltip-border)`,
                      borderRadius: 8,
                      color: 'var(--chart-tooltip-text)',
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${fmt(Number(v), 1)} kW`, 'Demand']}
                    labelFormatter={(l) => (typeof l === 'string' ? loadProfileTick(l) : String(l))}
                  />
                  <Area type="monotone" dataKey="demandKw" name="kW" stroke="var(--chart-2)" strokeWidth={2} fill="url(#lp-scada)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="min-h-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
            <div className="card card-hover overflow-hidden p-4">
              <DemandTracker variant="embedded" />
            </div>
            <div className="card card-hover min-h-0 overflow-hidden p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Fluctuations</div>
                <div className="text-[11px] text-[var(--muted)]">Δ &gt; 25% warn · &gt; 40% crit</div>
              </div>

              {fluctuationAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
                  No spikes detected in current window.
                </div>
              ) : (
                <div className="space-y-2">
                  {fluctuationAlerts.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_6%,var(--card))] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--text)]">{a.metric.toUpperCase()} spike</div>
                          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <Badge color={severityColor(a.severity)}>{a.severity}</Badge>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <div className="text-[10px] text-[var(--muted)]">Prev</div>
                          <div className="font-mono text-[var(--text)]">{fmt(a.prevValue, 1)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--muted)]">Now</div>
                          <div className="font-mono text-[var(--text)]">{fmt(a.value, 1)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[var(--muted)]">Δ%</div>
                          <div className="font-mono text-[var(--text)]">
                            {a.deltaPct === null ? '—' : `${fmt(a.deltaPct * 100, 0)}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

