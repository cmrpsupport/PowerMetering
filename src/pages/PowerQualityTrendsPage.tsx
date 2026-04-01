import { useMemo, useState } from 'react'
import MultiAxisTrendChart, { type TrendSeries } from '../components/charts/MultiAxisTrendChart'
import { StatCard } from '../components/ui/StatCard'
import { findPlcMeter } from '../constants/plcMeters'
import { useMeterHistory, useNodeRedHealth, usePlcFullSnapshot } from '../hooks/queries'
import { bucketMsForVisibleSpan, downsampleTrendForChart, type TrendPoint } from '../lib/trendSeries'
import type { MeterSamplePoint } from '../types'

type RangeOpt = { id: string; label: string; minutes: number }

const RANGE_OPTIONS: RangeOpt[] = [
  { id: '1h', label: 'Last 1 hour', minutes: 60 },
  { id: '6h', label: 'Last 6 hours', minutes: 6 * 60 },
  { id: '24h', label: 'Last 24 hours', minutes: 24 * 60 },
  { id: '7d', label: 'Last 7 days', minutes: 7 * 24 * 60 },
  { id: '30d', label: 'Last 30 days', minutes: 30 * 24 * 60 },
]

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function toTrendPoint(r: MeterSamplePoint): TrendPoint {
  return {
    ts: r.ts,
    kw: r.realPowerKw,
    voltageV: r.voltageLlAvg,
    currentA: r.currentAvg,
    pf: r.powerFactor,
    kvar: r.reactivePowerKvar,
  }
}

export function PowerQualityTrendsPage() {
  const { data: snap } = usePlcFullSnapshot()
  const { data: health } = useNodeRedHealth()
  const plcUp = health?.plcLink?.up === true

  const meterIds = useMemo(() => Object.keys(snap?.meters ?? {}).sort(), [snap?.meters])
  const [meterId, setMeterId] = useState<string>(() => meterIds[0] ?? '')
  const [rangeId, setRangeId] = useState<string>('24h')

  // Keep selection stable if meter list loads later / changes.
  const effectiveMeterId = useMemo(() => {
    if (meterId && meterIds.includes(meterId)) return meterId
    return meterIds[0] ?? ''
  }, [meterId, meterIds])

  const minutes = useMemo(() => RANGE_OPTIONS.find((r) => r.id === rangeId)?.minutes ?? 24 * 60, [rangeId])
  const historyQ = useMeterHistory(minutes, effectiveMeterId || undefined)
  const raw: MeterSamplePoint[] = useMemo(() => historyQ.data ?? [], [historyQ.data])

  const spanMs = useMemo(() => {
    if (raw.length < 2) return minutes * 60 * 1000
    const t0 = Date.parse(raw[raw.length - 1]!.ts)
    const t1 = Date.parse(raw[0]!.ts)
    const span = Math.abs(t1 - t0)
    return Number.isFinite(span) && span > 0 ? span : minutes * 60 * 1000
  }, [raw, minutes])

  const bucketMs = useMemo(() => bucketMsForVisibleSpan(spanMs), [spanMs])

  const chartData = useMemo(() => {
    const pts = raw.map(toTrendPoint)
    const down = downsampleTrendForChart(pts, spanMs)
    return down.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltage: p.voltageV,
      current: p.currentA,
      pf: p.pf ?? null,
      kvar: p.kvar ?? null,
    }))
  }, [raw, spanMs])

  const series = useMemo<TrendSeries[]>(
    () => [
      { key: 'voltage', label: 'V L-L avg', color: 'var(--chart-2)', yAxisId: 'left' },
      { key: 'current', label: 'I avg', color: 'var(--chart-3)', yAxisId: 'left' },
      { key: 'kw', label: 'kW', color: 'var(--chart-1)', yAxisId: 'right' },
      { key: 'pf', label: 'PF', color: 'var(--chart-4)', yAxisId: 'right' },
      { key: 'kvar', label: 'kVAR', color: 'color-mix(in srgb, var(--chart-3) 65%, var(--chart-axis))', yAxisId: 'right' },
    ],
    [],
  )

  const stats = useMemo(() => {
    if (!snap?.meters || !effectiveMeterId) return null
    const d = snap.meters[effectiveMeterId]
    if (!d) return null
    return {
      v: d.Voltage_Lave,
      f: d.Frequency,
      pf: d.Power_factor,
      i: d.Current_Ave,
    }
  }, [snap?.meters, effectiveMeterId])

  const meterName = useMemo(() => {
    if (!effectiveMeterId) return '—'
    return findPlcMeter(effectiveMeterId)?.name ?? effectiveMeterId
  }, [effectiveMeterId])

  return (
    <div className="scada-pq grid h-[calc(100vh-124px)] min-h-0 grid-rows-[auto_auto_auto_1fr] gap-3 overflow-hidden">
      {/* Header (compact) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Power Quality (SCADA)</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            Trends wrap into larger buckets as the range grows.
          </div>
        </div>
        <div className="shrink-0 text-xs text-[var(--muted)]">
          PLC:{' '}
          <span className={plcUp ? 'text-emerald-400' : 'text-red-400'}>{plcUp ? 'Connected' : 'Disconnected'}</span> · Bucket:{' '}
          {Math.round(bucketMs / 60000)} min
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-[var(--muted)]">
          <span className="mr-2">Meter</span>
          <select
            value={effectiveMeterId}
            onChange={(e) => setMeterId(e.target.value)}
            className="nr-input px-2.5 py-1.5"
          >
            {meterIds.length === 0 ? <option value="">No meters</option> : null}
            {meterIds.map((id) => (
              <option key={id} value={id}>
                {findPlcMeter(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-[var(--muted)]">
          <span className="mr-2">Range</span>
          <select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="nr-input px-2.5 py-1.5">
            {RANGE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 text-xs text-[var(--muted)]">
          Selected: <span className="truncate text-[var(--text)]">{meterName}</span>
        </div>
      </div>

      {/* KPI strip (fixed height) */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="V L-L (now)" value={stats ? `${fmt(stats.v, 0)} V` : '—'} />
        <StatCard title="Frequency (now)" value={stats ? `${fmt(stats.f, 2)} Hz` : '—'} />
        <StatCard title="PF (now)" value={stats ? fmt(stats.pf, 3) : '—'} />
        <StatCard title="I avg (now)" value={stats ? `${fmt(stats.i, 1)} A` : '—'} />
      </div>

      {/* Main chart area: fill remaining height, no page scroll */}
      <div className="min-h-0">
        <MultiAxisTrendChart data={chartData as Record<string, unknown>[]} series={series} height={420} />
        <div className="mt-2 text-[11px] text-[var(--muted)]">
          {historyQ.isLoading
            ? 'Loading history…'
            : chartData.length === 0
              ? 'No trend history available for this meter/range.'
              : `Points: ${chartData.length} · Range: ${minutes} min`}
        </div>
      </div>
    </div>
  )
}

