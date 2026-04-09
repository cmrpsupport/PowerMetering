import { useMemo, useState } from 'react'
import { usePowerTrend } from '../hooks/queries'
import { ChevronLeft, ChevronRight, Radio } from 'lucide-react'
import {
  Area,
  AreaChart,
  ComposedChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateTrendByBucket,
  bucketMsForVisibleSpan,
  detectGaps,
  downsampleTrendForChart,
  injectGapSentinels,
} from '../lib/trendSeries'

type ZoomLevel = '1h' | '6h' | '24h' | '7d' | '30d'

/**
 * Per zoom level:
 *   spanMs       – how much time is visible in the main chart
 *   fetchMinutes – how much history to fetch (the scrollable buffer)
 *   bucket       – server-side aggregation passed to /api/trends
 *
 * Only the visible slice of fetchMinutes is rendered in the chart SVG, so
 * even a 90-day buffer only puts ~168 points into the DOM at a time.
 */
const ZOOM_CFG: Record<ZoomLevel, { spanMs: number; fetchMinutes: number; bucket?: '1m' | '5m' | '15m' | '1h' | '1d' }> = {
  '1h':  { spanMs: 60 * 60_000,           fetchMinutes: 3 * 24 * 60              },
  '6h':  { spanMs: 6 * 60 * 60_000,       fetchMinutes: 7 * 24 * 60,  bucket: '5m'  },
  '24h': { spanMs: 24 * 60 * 60_000,      fetchMinutes: 30 * 24 * 60, bucket: '15m' },
  '7d':  { spanMs: 7 * 24 * 60 * 60_000,  fetchMinutes: 90 * 24 * 60, bucket: '1h'  },
  '30d': { spanMs: 30 * 24 * 60 * 60_000, fetchMinutes: 366 * 24 * 60, bucket: '1d' },
}

const ZOOM_LABELS: ZoomLevel[] = ['1h', '6h', '24h', '7d', '30d']

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

function fmtRange(startMs: number, endMs: number, spanMs: number): string {
  const start = new Date(startMs)
  const end = new Date(endMs)
  const sameDay = start.toDateString() === end.toDateString()
  if (spanMs <= 24 * 60 * 60_000 && sameDay) {
    return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}  ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

export function PvcTrendsPage() {
  const [zoom, setZoom] = useState<ZoomLevel>('24h')
  // null = live edge (always follows latest data)
  const [viewEndMs, setViewEndMs] = useState<number | null>(null)

  const cfg = ZOOM_CFG[zoom]
  const isLive = viewEndMs === null
  const effectiveEndMs = viewEndMs ?? Date.now()
  const effectiveStartMs = effectiveEndMs - cfg.spanMs

  const trendQ = usePowerTrend(cfg.fetchMinutes, { bucket: cfg.bucket })

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

  // Oldest available data point
  const dataStartMs = powerTrendFull.length > 0 ? Date.parse(powerTrendFull[0].ts) : Date.now()

  // Can we pan further back? Only if there's data before the current view start.
  const canPanBack = dataStartMs < effectiveStartMs - 1_000

  // Pan by one visible span
  const panBack = () => setViewEndMs(effectiveEndMs - cfg.spanMs)
  const panForward = () => {
    const next = effectiveEndMs + cfg.spanMs
    if (next >= Date.now() - 30_000) {
      setViewEndMs(null) // snap back to live
    } else {
      setViewEndMs(next)
    }
  }
  const goToNow = () => setViewEndMs(null)
  const handleZoomChange = (z: ZoomLevel) => {
    setZoom(z)
    setViewEndMs(null) // reset to live on zoom change
  }

  // Filtered slice for the main chart
  const pvcVisible = useMemo(() => {
    const nowEndMs = viewEndMs ?? Date.now()
    const startMs = nowEndMs - cfg.spanMs
    return powerTrendFull.filter((p) => {
      const t = Date.parse(p.ts)
      return t >= startMs && t <= nowEndMs
    })
  // Re-derive when live (viewEndMs===null) so the chart auto-advances with new data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerTrendFull, viewEndMs, cfg.spanMs])

  const pvcSpanMs = useMemo(() => {
    if (pvcVisible.length < 2) return 0
    return Date.parse(pvcVisible[pvcVisible.length - 1].ts) - Date.parse(pvcVisible[0].ts)
  }, [pvcVisible])

  const pvcTick = useMemo(() => {
    if (pvcSpanMs >= 7 * 24 * 60 * 60_000) {
      return (v: unknown) => new Date(String(v)).toLocaleDateString([], { month: 'short', day: '2-digit' })
    }
    if (pvcSpanMs >= 24 * 60 * 60_000) {
      return (v: unknown) =>
        new Date(String(v)).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
    return (v: unknown) => new Date(String(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [pvcSpanMs])

  const pvcMainSeries = useMemo(() => {
    const pts = pvcVisible.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltageV: p.voltageV,
      currentA: p.currentA,
      pf: p.pf ?? 0,
      kvar: p.kvar ?? 0,
    }))
    const down = downsampleTrendForChart(pts, pvcSpanMs)
    const bucketMs = bucketMsForVisibleSpan(pvcSpanMs)
    return aggregateTrendByBucket(down, bucketMs)
  }, [pvcVisible, pvcSpanMs])

  const pvcBucketMs = useMemo(() => bucketMsForVisibleSpan(pvcSpanMs), [pvcSpanMs])
  const pvcGaps = useMemo(() => detectGaps(pvcMainSeries, pvcBucketMs), [pvcMainSeries, pvcBucketMs])
  const pvcSeriesWithBreaks = useMemo(
    () => injectGapSentinels(pvcMainSeries, pvcGaps, ['kw', 'voltageV', 'currentA']),
    [pvcMainSeries, pvcGaps],
  )

  // Overview strip: full fetched range, downsampled to ~400 pts
  const navSeries = useMemo(() => {
    if (powerTrendFull.length < 2) return powerTrendFull
    const fullSpanMs = Date.parse(powerTrendFull[powerTrendFull.length - 1].ts) - Date.parse(powerTrendFull[0].ts)
    const bucketMs = Math.max(
      bucketMsForVisibleSpan(fullSpanMs),
      Math.ceil(fullSpanMs / 400 / (60 * 1000)) * (60 * 1000),
    )
    return aggregateTrendByBucket(powerTrendFull.map((p) => ({
      ts: p.ts, kw: p.kw, voltageV: p.voltageV, currentA: p.currentA,
      pf: p.pf ?? 0, kvar: p.kvar ?? 0,
    })), bucketMs)
  }, [powerTrendFull])

  // Viewport highlight for the overview strip
  const navViewport = useMemo(() => {
    if (navSeries.length === 0) return null
    const startIso = new Date(effectiveStartMs).toISOString()
    const endIso = new Date(effectiveEndMs).toISOString()
    return { x1: startIso, x2: endIso }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSeries, effectiveStartMs, effectiveEndMs])

  return (
    <div className="grid h-[calc(100vh-124px)] min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Power / Voltage / Current</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {trendQ.isFetching ? 'Loading…' : fmtRange(effectiveStartMs, effectiveEndMs, cfg.spanMs)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom level */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_5%,var(--card))] p-0.5">
            <span className="px-1.5 text-[10px] font-semibold uppercase text-[var(--muted)]">Zoom</span>
            {ZOOM_LABELS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => handleZoomChange(z)}
                className={[
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                  zoom === z
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {z}
              </button>
            ))}
          </div>

          {/* Pan controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={panBack}
              disabled={!canPanBack}
              title="Scroll back one window"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={panForward}
              disabled={isLive}
              title="Scroll forward one window"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] transition hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={goToNow}
              disabled={isLive}
              title="Jump to live data"
              className={[
                'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                isLive
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              <Radio size={11} className={isLive ? 'animate-pulse' : ''} />
              {isLive ? 'Live' : 'Now'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Chart card ── */}
      <div className="card card-hover flex min-h-0 flex-col overflow-hidden p-4">
        <div className="min-h-0 flex-1">
          {/* Main chart */}
          <div className="h-[420px] min-h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pvcSeriesWithBreaks} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
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
                <Area yAxisId="left" type="monotone" dataKey="kw" name="kW" stroke="var(--chart-1)" strokeWidth={2} fill="url(#pvc-kw-page)" dot={false} connectNulls={false} isAnimationActive={false} />
                <Area yAxisId="right" type="monotone" dataKey="voltageV" name="Voltage (V)" stroke="var(--chart-2)" strokeWidth={2} fill="url(#pvc-v-page)" dot={false} connectNulls={false} isAnimationActive={false} />
                <Area yAxisId="right" type="monotone" dataKey="currentA" name="Current (A)" stroke="var(--chart-3)" strokeWidth={2} fill="url(#pvc-i-page)" dot={false} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Overview strip — full fetched range with viewport highlighted */}
          {navSeries.length > 0 && (
            <div className="mt-2 h-16 w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))] p-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={navSeries} margin={{ left: 6, right: 10, top: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="pvc-nav-page" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="ts" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" fill="url(#pvc-nav-page)" dot={false} isAnimationActive={false} />
                  {/* Highlight the current viewport window */}
                  {navViewport && (
                    <ReferenceArea
                      x1={navViewport.x1}
                      x2={navViewport.x2}
                      fill="var(--primary)"
                      fillOpacity={0.15}
                      stroke="var(--primary)"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
