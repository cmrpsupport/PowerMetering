import { useMemo, useState } from 'react'
import { usePowerTrend } from '../hooks/queries'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateTrendByBucket,
  bucketMsForNavigatorFullSpan,
  bucketMsForVisibleSpan,
  detectGaps,
  downsampleTrendForChart,
  type TrendPoint,
} from '../lib/trendSeries'

type TrendWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '6mo' | '1y' | 'all'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

export function PvcTrendsPage() {
  const [trendWindow, setTrendWindow] = useState<TrendWindow>('30d')

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
              : trendWindow === '30d'
                ? 30 * 24 * 60
                : trendWindow === '6mo'
                  ? 183 * 24 * 60
                  : trendWindow === '1y'
                    ? 365 * 24 * 60
                    : 366 * 24 * 60

  const trendBucket =
    trendWindow === '30d' ? '15m' : trendWindow === '6mo' ? '1h' : trendWindow === '1y' ? '1h' : trendWindow === 'all' ? '1d' : undefined

  const trendQ = usePowerTrend(trendMinutes, { bucket: trendBucket })

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

  const pvcSpanMs = useMemo(() => {
    if (powerTrendFull.length < 2) return 0
    return Date.parse(powerTrendFull[powerTrendFull.length - 1].ts) - Date.parse(powerTrendFull[0].ts)
  }, [powerTrendFull])

  const pvcTick = useMemo(() => {
    if (pvcSpanMs >= 1000 * 60 * 60 * 24 * 14) {
      return (v: unknown) => new Date(String(v)).toLocaleDateString([], { month: 'short', day: '2-digit' })
    }
    if (pvcSpanMs >= 1000 * 60 * 60 * 24) {
      return (v: unknown) =>
        new Date(String(v)).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
    return (v: unknown) => new Date(String(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [pvcSpanMs])

  const pvcMainSeries = useMemo(() => {
    const pts = powerTrendFull.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltageV: p.voltageV,
      currentA: p.currentA,
      pf: p.pf,
      kvar: p.kvar,
    }))
    const down = downsampleTrendForChart(pts, pvcSpanMs)
    const bucketMs = bucketMsForVisibleSpan(pvcSpanMs)
    return aggregateTrendByBucket(down, bucketMs)
  }, [powerTrendFull, pvcSpanMs])

  const pvcBucketMs = useMemo(() => bucketMsForVisibleSpan(pvcSpanMs), [pvcSpanMs])
  const pvcGaps = useMemo(() => detectGaps(pvcMainSeries, pvcBucketMs), [pvcMainSeries, pvcBucketMs])

  return (
    <div className="grid h-[calc(100vh-124px)] min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Power / Voltage / Current</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">Shaded trends with navigator. Drag brush to pan/zoom.</div>
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
            { id: '6mo', label: '6mo' },
            { id: '1y', label: '1y' },
            { id: 'all', label: 'All' },
          ]}
        />
      </div>

      <div className="card card-hover flex min-h-0 flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1">
          <div className="h-[420px] min-h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pvcMainSeries} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="pvc-kw-page" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="pvc-v-page" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="pvc-i-page" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                  <pattern id="pvc-gap-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(239,68,68,0.35)" strokeWidth="3" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="ts" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" minTickGap={22} tickFormatter={pvcTick} />
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
                  formatter={(v: unknown, name: unknown) => {
                    const n = Number(v)
                    if (!Number.isFinite(n)) return ['—', String(name)]
                    return [fmt(n, name === 'kW' ? 1 : 0), String(name)]
                  }}
                />
                <Legend wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
                {pvcGaps.map((g, i) => (
                  <ReferenceArea
                    key={i}
                    yAxisId="left"
                    x1={g.x1}
                    x2={g.x2}
                    fill="url(#pvc-gap-hatch)"
                    stroke="rgba(239,68,68,0.4)"
                    strokeWidth={1}
                    label={
                      g.durationMs > pvcBucketMs * 6
                        ? { value: 'No data', position: 'insideTop', fill: 'rgba(239,68,68,0.8)', fontSize: 9 }
                        : undefined
                    }
                  />
                ))}
                <Area yAxisId="left" type="monotone" dataKey="kw" name="kW" stroke="var(--chart-1)" strokeWidth={2} fill="url(#pvc-kw-page)" dot={false} connectNulls />
                <Area yAxisId="right" type="monotone" dataKey="voltageV" name="Voltage (V)" stroke="var(--chart-2)" strokeWidth={2} fill="url(#pvc-v-page)" dot={false} connectNulls />
                <Area yAxisId="right" type="monotone" dataKey="currentA" name="Current (A)" stroke="var(--chart-3)" strokeWidth={2} fill="url(#pvc-i-page)" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {pvcNavSeries.length > 0 ? (
            <div className="mt-2 h-16 w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))] p-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pvcNavSeries} margin={{ left: 6, right: 10, top: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="pvc-nav-page" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="ts" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" fill="url(#pvc-nav-page)" dot={false} isAnimationActive={false} />
                  <Brush dataKey="ts" height={18} stroke="var(--primary)" travellerWidth={10} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

