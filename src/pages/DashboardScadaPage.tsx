import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEnergyIntervals, usePlantLoadProfile, useNodeRedHealth, usePlcFullSnapshot, usePowerTrend } from '../hooks/queries'
import { DemandTracker } from '../components/ui/DemandTracker'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { KpiCard, type KpiStatus } from '../components/ui/KpiCard'
import { Activity, Bolt, Gauge, Layers, Percent, Waves, Zap } from 'lucide-react'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateEnergyIntervalsByTimestamp,
  aggregateEnergyIntervalsToHourly,
  aggregateKwhSumByTimeBucket,
  downsampleEnergyRowsSum,
} from '../lib/energyHourly'
import type { EnergyIntervalBucket } from '../api/powerApi'
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

function pfStatus(pf: number): KpiStatus {
  if (!Number.isFinite(pf) || pf <= 0) return 'normal'
  if (pf >= 0.95) return 'good'
  if (pf >= 0.85) return 'warning'
  return 'critical'
}

type TrendWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '6mo' | '1y'
type EnergyWindow = TrendWindow | 'all'
type LineEnergyWindow = 'daily' | 'weekly' | 'monthly' | '1y'
type LineEnergyViewMode = 'abs' | 'pct'

function AxisTickAngled({
  x,
  y,
  payload,
  formatter,
}: {
  x?: number
  y?: number
  payload?: { value?: unknown }
  formatter: (v: unknown) => string
}) {
  const xv = Number(x ?? 0)
  const yv = Number(y ?? 0)
  const v = payload?.value
  const text = formatter(v)
  return (
    <g transform={`translate(${xv},${yv})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        transform="rotate(-8)"
        style={{
          fill: 'var(--text)',
          fontSize: 10,
          fontWeight: 600,
          filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.35))',
        }}
      >
        {text}
      </text>
    </g>
  )
}

export function DashboardScadaPage() {
  const snapQ = usePlcFullSnapshot()
  const healthQ = useNodeRedHealth()
  const plcUp = healthQ.data?.plcLink?.up === true

  const [trendWindow, setTrendWindow] = useState<TrendWindow>('30d')
  const [energyWindow, setEnergyWindow] = useState<EnergyWindow>('30d')
  const [showLineEnergy, setShowLineEnergy] = useState(false)
  const [lineEnergyWindow, setLineEnergyWindow] = useState<LineEnergyWindow>('weekly')
  const [lineEnergyHover, setLineEnergyHover] = useState<{ line: string; kwh: number } | null>(null)
  const [lineEnergyViewMode, setLineEnergyViewMode] = useState<LineEnergyViewMode>('abs')
  const [loadProfileBucket, setLoadProfileBucket] = useState<'1m' | '5m' | '15m' | '1h'>('5m')
  const [energyResolution, setEnergyResolution] = useState<EnergyIntervalBucket>('15m')
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
                  : 365 * 24 * 60
  // Long windows are server-aggregated via /api/trends/power/history.
  const trendBucket = trendWindow === '30d' ? '15m' : trendWindow === '6mo' ? '1h' : trendWindow === '1y' ? '1h' : undefined
  // Always keep enough history for fluctuation detection, even when viewing 1h/6h/etc.
  const fetchMinutes = Math.max(trendMinutes, 24 * 60)
  const trendQ = usePowerTrend(fetchMinutes, { bucket: trendBucket })
  const loadProfileQ = usePlantLoadProfile(24, { bucket: loadProfileBucket })
  const energy48hQ = useEnergyIntervals(48)
  const lineEnergyHours =
    lineEnergyWindow === 'daily' ? 24 : lineEnergyWindow === 'weekly' ? 24 * 7 : lineEnergyWindow === 'monthly' ? 24 * 30 : 24 * 365
  const lineEnergyQ = useEnergyIntervals(lineEnergyHours)
  // Pull enough buckets to cover current + previous month for MTD comparison.
  const energyMonthQ = useEnergyIntervals(24 * 75)

  const energyHours =
    energyWindow === '1h'
      ? 1
      : energyWindow === '6h'
        ? 6
        : energyWindow === '12h'
          ? 12
          : energyWindow === '24h'
            ? 24
            : energyWindow === '7d'
              ? 7 * 24
              : energyWindow === '30d'
                ? 30 * 24
                : energyWindow === '6mo'
                  ? 183 * 24
                  : energyWindow === '1y'
                    ? 365 * 24
                    : 366 * 24

  const energyTrendQ = useEnergyIntervals(energyHours, { bucket: energyResolution })

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

  const monthKwh = useMemo(() => {
    const ivs = energyMonthQ.data ?? []
    if (ivs.length === 0) return NaN
    const now = new Date()
    const startThis = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const endPrevMtd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1, 0, 0, 0, 0)

    let thisMtd = 0
    let prevMtd = 0
    for (const iv of ivs) {
      const t = Date.parse(iv.ts)
      if (!Number.isFinite(t)) continue
      const e = Number(iv.energyKwh)
      if (!Number.isFinite(e)) continue

      if (t >= startThis.getTime()) thisMtd += e
      else if (t >= startPrev.getTime() && t < endPrevMtd.getTime()) prevMtd += e
    }

    const thisOk = thisMtd > 0
    const prevOk = prevMtd > 0
    const deltaKwh = thisOk && prevOk ? thisMtd - prevMtd : null
    return {
      thisMtd: thisMtd > 0 ? thisMtd : NaN,
      prevMtd: prevMtd > 0 ? prevMtd : NaN,
      deltaKwh,
    }
  }, [energyMonthQ.data])

  const energyHourly = useMemo(() => {
    const ivs = energy48hQ.data ?? []
    if (ivs.length === 0) return { series: [] as number[] }

    // Aggregate across meters by hour bucket timestamp.
    const byTs = new Map<string, number>()
    for (const iv of ivs) {
      const ts = iv.ts
      if (!ts) continue
      const e = Number(iv.energyKwh)
      if (!Number.isFinite(e)) continue
      byTs.set(ts, (byTs.get(ts) ?? 0) + e)
    }

    const rows = Array.from(byTs.entries())
      .map(([ts, kwh]) => ({ ts, kwh }))
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))

    const last24 = rows.slice(-24)
    const series = last24.map((r) => r.kwh)

    return { series }
  }, [energy48hQ.data])

  const lineDefs = useMemo(() => PLC_PRODUCTION_METERS, [])

  const lineKeyForIntervals = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>()
    for (const l of lineDefs) {
      // Backend /api/energy/intervals uses ids like "line-01" (not "plc-line-01").
      const key = l.id.replace(/^plc-/, '')
      map.set(key, { key, name: l.name })
    }
    return map
  }, [lineDefs])

  const lineEnergyBars = useMemo(() => {
    const ivs = lineEnergyQ.data ?? []
    if (ivs.length === 0) return [] as Array<Record<string, string | number>>

    const dayKey = (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }

    const byDay = new Map<string, Record<string, number>>()
    for (const iv of ivs) {
      const key = String(iv.meterId ?? '')
      if (!lineKeyForIntervals.has(key)) continue
      const day = dayKey(iv.ts)
      const e = Number(iv.energyKwh)
      if (!Number.isFinite(e)) continue
      const row = byDay.get(day) ?? {}
      row[key] = (row[key] ?? 0) + e
      byDay.set(day, row)
    }

    const days = Array.from(byDay.keys()).sort((a, b) => (a < b ? -1 : 1))
    const dayCount = lineEnergyWindow === 'daily' ? 1 : lineEnergyWindow === 'weekly' ? 7 : lineEnergyWindow === 'monthly' ? 30 : 365
    const lastN = days.slice(-dayCount)
    const totalsByLine = new Map<string, number>()
    for (const d of lastN) {
      const row = byDay.get(d) ?? {}
      for (const [k, v] of Object.entries(row)) totalsByLine.set(k, (totalsByLine.get(k) ?? 0) + (Number.isFinite(v) ? v : 0))
    }

    return lineDefs
      .map((l) => {
        const key = l.id.replace(/^plc-/, '')
        return { id: key, line: l.name, kwh: totalsByLine.get(key) ?? 0 }
      })
      .filter((r) => Number(r.kwh) > 0)
  }, [lineEnergyQ.data, lineEnergyWindow, lineDefs, lineKeyForIntervals])

  const lineEnergyGrouped = useMemo(() => {
    const rows = (lineEnergyBars as Array<{ id: string; line: string; kwh: number }>).slice()
    const total = rows.reduce((a, b) => a + (Number.isFinite(b.kwh) ? b.kwh : 0), 0)
    const toPct = (kwh: number) => (total > 0 ? (kwh / total) * 100 : 0)

    const cat = (name: string) => {
      const n = name.toLowerCase()
      if (n.startsWith('utilities')) return 'utilities'
      if (n.startsWith('main')) return 'utilities'
      return 'production'
    }

    const mapped = rows.map((r) => ({
      ...r,
      pct: toPct(r.kwh),
      category: cat(r.line) as 'production' | 'utilities',
    }))

    const prod = mapped.filter((r) => r.category === 'production').sort((a, b) => b.kwh - a.kwh)
    const util = mapped.filter((r) => r.category === 'utilities').sort((a, b) => b.kwh - a.kwh)

    return { prod, util, totalKwh: total }
  }, [lineEnergyBars])

  const fmtCompact = (n: number) => {
    if (!Number.isFinite(n)) return '—'
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`
    if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1)}k`
    return `${Math.round(n)}`
  }

  const lineBarLabel = (mode: LineEnergyViewMode) => (p: unknown) => {
    const v = Number((p as { value?: unknown }).value)
    if (!Number.isFinite(v) || v <= 0) return null
    const text = mode === 'pct' ? `${v.toFixed(v >= 10 ? 0 : 1)}%` : `${fmtCompact(v)}`
    return (
      <text
        x={(p as { x?: number }).x}
        y={(p as { y?: number }).y}
        dx={(p as { width?: number }).width ? Number((p as { width?: number }).width) / 2 : 0}
        dy={-6}
        textAnchor="middle"
        style={{
          fill: 'var(--text)',
          fontSize: 10,
          fontWeight: 600,
          filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.25))',
        }}
      >
        {text}
      </text>
    )
  }

  const shortLineName = (name: string) => {
    // Keep labels readable in a dense 12-bar chart.
    const n = name.replace(/\s+/g, ' ').trim()
    if (/^Cracker Line 1$/i.test(n)) return 'Cracker1'
    if (/^Cracker Line 2$/i.test(n)) return 'Cracker2'
    if (/^Pretzel Line$/i.test(n)) return 'Pretzel'
    if (/^Wafer Line 1$/i.test(n)) return 'Wafer1'
    if (/^Wafer Line 2$/i.test(n)) return 'Wafer2'
    if (/^Chooey Choco Line$/i.test(n)) return 'Choco'
    if (/^Dynamite Line$/i.test(n)) return 'Dynamite'
    if (/^XO Line$/i.test(n)) return 'XO'
    if (/^Maxx Line$/i.test(n)) return 'Maxx'
    if (/^Main Line$/i.test(n)) return 'Main'
    if (/^Utilities Jaguar$/i.test(n)) return 'Util Jaguar'
    if (/^Utilities Lighting$/i.test(n)) return 'Util Light'
    return n.replace(/\s*Line\s*/gi, '').trim()
  }

  const energyTrend = useMemo(() => {
    const ivs = energyTrendQ.data ?? []
    if (ivs.length === 0) return { series: [] as Array<Record<string, number | string>>, spanMs: 0 }

    const lineIdSet = new Set(lineKeyForIntervals.keys())
    const lineKeyList = Array.from(lineIdSet)
    const merged =
      energyResolution === '1h'
        ? aggregateEnergyIntervalsToHourly(ivs, lineIdSet)
        : aggregateEnergyIntervalsByTimestamp(ivs, lineIdSet)

    const t0 = merged.length ? Date.parse(String(merged[0].ts)) : 0
    const t1 = merged.length ? Date.parse(String(merged[merged.length - 1].ts)) : 0
    const spanMs = Number.isFinite(t0) && Number.isFinite(t1) ? Math.max(0, t1 - t0) : 0

    const maxPts = 2200
    const rows =
      merged.length > maxPts ? downsampleEnergyRowsSum(merged, maxPts, lineKeyList) : merged

    return { series: rows, spanMs }
  }, [energyTrendQ.data, lineKeyForIntervals, energyResolution])

  const energyTick = useMemo(() => {
    if (energyTrend.spanMs >= 1000 * 60 * 60 * 24 * 14) {
      return (v: unknown) => new Date(String(v)).toLocaleDateString([], { month: 'short', day: '2-digit' })
    }
    if (energyTrend.spanMs >= 1000 * 60 * 60 * 24) {
      return (v: unknown) =>
        new Date(String(v)).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
    return (v: unknown) => new Date(String(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [energyTrend.spanMs])

  const energyAreaType = energyResolution === '1h' ? 'stepAfter' : 'monotone'

  const energyNavSeries = useMemo(() => {
    const rows = energyTrend.series as Array<{ ts: string; kwh: number }>
    if (rows.length === 0) return [] as { ts: string; kwh: number }[]
    const bucketMs = bucketMsForNavigatorFullSpan(energyTrend.spanMs, 1200)
    return aggregateKwhSumByTimeBucket(rows, bucketMs)
  }, [energyTrend.series, energyTrend.spanMs])

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

  const pvcSpark = useMemo(() => {
    const last = pvcMainSeries.slice(-28)
    return {
      kw: last.map((p) => p.kw),
      v: last.map((p) => p.voltageV),
      i: last.map((p) => p.currentA),
      pf: last.map((p) => p.pf),
    }
  }, [pvcMainSeries])

  const pvcDelta = useMemo(() => {
    const last = pvcMainSeries
    const prev = last.length >= 2 ? last[last.length - 2] : null
    const cur = last.length >= 1 ? last[last.length - 1] : null
    const pct = (a: number | undefined, b: number | undefined) => {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null
      const denom = Math.max(1e-9, Math.abs(Number(a)))
      return (Number(b) - Number(a)) / denom
    }
    return {
      kw: prev && cur ? pct(prev.kw, cur.kw) : null,
      v: prev && cur ? pct(prev.voltageV, cur.voltageV) : null,
      i: prev && cur ? pct(prev.currentA, cur.currentA) : null,
      pf: prev && cur ? pct(prev.pf, cur.pf) : null,
    }
  }, [pvcMainSeries])

  const loadProfile24h = loadProfileQ.data ?? []

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
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">Single-screen overview.</div>
        </div>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <KpiCard
          title="Plant power"
          value={plantNow ? fmt(plantNow.kw, 1) : '—'}
          unit="kW"
          status="normal"
          icon={<Bolt size={18} />}
          deltaPct={pvcDelta.kw}
          deltaLabel="latest tick"
          sparkline={pvcSpark.kw}
        />
        <KpiCard
          title="Energy (MTD)"
          value={Number.isFinite(monthKwh.thisMtd) ? fmt(monthKwh.thisMtd, 0) : '—'}
          unit="kWh"
          status="normal"
          icon={<Layers size={18} />}
          sparkline={energyHourly.series}
          subtext={
            Number.isFinite(monthKwh.prevMtd) ? (
              <span>
                Prev MTD: <span className="font-mono">{fmt(monthKwh.prevMtd, 0)}</span> kWh
              </span>
            ) : (
              'Prev month data unavailable'
            )
          }
        />
        <KpiCard
          title="Reactive"
          value={plantNow ? fmt(plantNow.kvar, 1) : '—'}
          unit="kVAR"
          status="normal"
          icon={<Zap size={18} />}
          sparkline={pvcSpark.kw}
        />
        <KpiCard
          title="Current avg"
          value={plantNow ? fmt(plantNow.amps, 0) : '—'}
          unit="A"
          status="normal"
          icon={<Activity size={18} />}
          deltaPct={pvcDelta.i}
          deltaLabel="latest tick"
          sparkline={pvcSpark.i}
        />
        <KpiCard
          title="Voltage L-L avg"
          value={plantNow ? fmt(plantNow.vAvg, 0) : '—'}
          unit="V"
          status="normal"
          icon={<Waves size={18} />}
          deltaPct={pvcDelta.v}
          deltaLabel="latest tick"
          sparkline={pvcSpark.v}
        />
        <KpiCard
          title="Frequency avg"
          value={plantNow ? fmt(plantNow.hzAvg, 2) : '—'}
          unit="Hz"
          status="normal"
          icon={<Gauge size={18} />}
        />
        <KpiCard
          title="Power factor avg"
          value={plantNow ? fmt(plantNow.pfAvg, 3) : '—'}
          status={plantNow ? pfStatus(plantNow.pfAvg) : 'normal'}
          icon={<Percent size={18} />}
          deltaPct={pvcDelta.pf}
          deltaLabel="latest tick"
          targetText="Target ≥ 0.950"
          sparkline={pvcSpark.pf}
        />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-4">
        <div className="grid min-h-0 gap-3 lg:col-span-3 lg:grid-rows-[1fr_auto]">
          <div className="card card-hover flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text)]">Energy consumption</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLineEnergy((v) => !v)}
                  className={[
                    'rounded-xl border px-2.5 py-1.5 text-xs font-medium transition',
                    showLineEnergy
                      ? 'border-[color-mix(in_srgb,var(--chart-4)_35%,var(--border))] bg-[color-mix(in_srgb,var(--chart-4)_10%,var(--card))] text-[var(--text)]'
                      : 'border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] text-[var(--muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                  title="Show/hide per-line energy series"
                >
                  Lines
                </button>
                <SegmentedControl
                  value={energyResolution}
                  onChange={(id) => setEnergyResolution(id as EnergyIntervalBucket)}
                  options={[
                    { id: '5m', label: '5m' },
                    { id: '15m', label: '15m' },
                    { id: '1h', label: 'Hourly' },
                  ]}
                />
                <SegmentedControl
                  value={energyWindow}
                  onChange={(id) => setEnergyWindow(id as EnergyWindow)}
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
                <Link to="/dashboard/pvc" className="text-xs text-[var(--primary)] hover:underline">
                  View PVC
                </Link>
              </div>
            </div>

            <div className="min-h-0 flex-1 flex flex-col">
              <div className="min-h-0 flex-1 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={energyTrend.series} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="energy-kwh-scada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="ts"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                      stroke="var(--chart-axis)"
                      minTickGap={energyResolution === '5m' ? 10 : 22}
                      tickFormatter={energyTick}
                    />
                    <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" width={56} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--chart-tooltip-bg)',
                        border: `1px solid var(--chart-tooltip-border)`,
                        borderRadius: 8,
                        color: 'var(--chart-tooltip-text)',
                        fontSize: 12,
                      }}
                      formatter={(v) => [`${fmt(Number(v), 1)} kWh`, 'Energy']}
                    />
                    <Legend wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
                    <Area
                      type={energyAreaType}
                      dataKey="kwh"
                      name="kWh"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      fill="url(#energy-kwh-scada)"
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                    {showLineEnergy
                      ? lineDefs.map((l, idx) => {
                          const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']
                          const stroke = colors[idx % colors.length]
                          const key = l.id.replace(/^plc-/, '')
                          return (
                            <Area
                              key={l.id}
                              type={energyAreaType}
                              dataKey={key}
                              name={l.name}
                              stroke={stroke}
                              strokeWidth={1.5}
                              fill="transparent"
                              dot={false}
                              connectNulls
                              isAnimationActive={false}
                              opacity={0.9}
                            />
                          )
                        })
                      : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {energyNavSeries.length > 0 ? (
                <div className="mt-2 h-16 w-full shrink-0 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))] p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={energyNavSeries} margin={{ left: 6, right: 10, top: 2, bottom: 2 }}>
                      <defs>
                        <linearGradient id="energy-nav-scada" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="ts" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Area
                        type={energyAreaType}
                        dataKey="kwh"
                        stroke="var(--chart-4)"
                        fill="url(#energy-nav-scada)"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Brush dataKey="ts" height={18} stroke="var(--primary)" travellerWidth={10} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card card-hover overflow-hidden p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">24-hour load profile</div>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    value={loadProfileBucket}
                    onChange={(id) => setLoadProfileBucket(id as typeof loadProfileBucket)}
                    options={[
                      { id: '1m', label: '1m' },
                      { id: '5m', label: '5m' },
                      { id: '15m', label: '15m' },
                      { id: '1h', label: '1h' },
                    ]}
                  />
                  <div className="text-[11px] text-[var(--muted)]">Avg kW · plant total</div>
                </div>
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
                    <XAxis
                      dataKey="ts"
                      tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                      stroke="var(--chart-axis)"
                      tickFormatter={loadProfileTick}
                      minTickGap={30}
                    />
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
                    <Area
                      type="monotone"
                      dataKey="demandKw"
                      name="kW"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#lp-scada)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card card-hover overflow-hidden p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Energy by line</div>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={lineEnergyViewMode}
                    onChange={(id) => setLineEnergyViewMode(id as LineEnergyViewMode)}
                    options={[
                      { id: 'abs', label: 'kWh' },
                      { id: 'pct', label: '%' },
                    ]}
                  />
                  <div className="text-[11px] text-[var(--muted)]">
                    {lineEnergyWindow === 'daily'
                      ? 'Last 24h total'
                      : lineEnergyWindow === 'weekly'
                        ? 'Last 7 days total'
                        : lineEnergyWindow === 'monthly'
                          ? 'Last 30 days total'
                          : 'Last 1 year total'}
                  </div>
                  <SegmentedControl
                    value={lineEnergyWindow}
                    onChange={(id) => setLineEnergyWindow(id as LineEnergyWindow)}
                    options={[
                      { id: 'daily', label: 'Daily' },
                      { id: 'weekly', label: 'Weekly' },
                      { id: 'monthly', label: 'Monthly' },
                      { id: '1y', label: '1yr' },
                    ]}
                  />
                </div>
              </div>
              <div className="relative h-80 min-h-[280px] w-full min-w-0">
                {lineEnergyHover && (
                  <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-baseline gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 shadow-sm">
                    <span className="text-[11px] text-[var(--muted)]">{lineEnergyHover.line}</span>
                    <span className="font-mono text-lg font-semibold text-[var(--text)]">{fmt(lineEnergyHover.kwh, 0)}</span>
                    <span className="text-[11px] text-[var(--muted)]">kWh</span>
                  </div>
                )}
                <div className="grid h-full grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">Production lines</div>
                    <div className="h-[calc(100%-18px)] min-h-0 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={lineEnergyGrouped.prod}
                          layout="vertical"
                          margin={{ left: 4, right: 10, top: 6, bottom: 0 }}
                          barCategoryGap={6}
                          barGap={2}
                          onMouseMove={(st) => {
                            const p =
                              (st as unknown as { activePayload?: Array<{ payload?: { line?: string; kwh?: number } }> }).activePayload?.[0]?.payload
                            if (p?.line && Number.isFinite(Number(p.kwh))) setLineEnergyHover({ line: String(p.line), kwh: Number(p.kwh) })
                          }}
                          onMouseLeave={() => setLineEnergyHover(null)}
                        >
                          <defs>
                            <linearGradient id="energy-bars-magenta" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="rgb(217 70 239)" stopOpacity={0.12} />
                              <stop offset="45%" stopColor="rgb(217 70 239)" stopOpacity={0.55} />
                              <stop offset="100%" stopColor="rgb(217 70 239)" stopOpacity={0.95} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid horizontal={false} stroke="color-mix(in_srgb, var(--text) 10%, transparent)" />
                          <XAxis
                            type="number"
                            domain={lineEnergyViewMode === 'pct' ? [0, 100] : [0, 'auto']}
                            tick={{ fill: 'var(--text)', fontSize: 10 }}
                            axisLine={{ stroke: 'color-mix(in_srgb, var(--text) 22%, transparent)' }}
                            tickLine={{ stroke: 'color-mix(in_srgb, var(--text) 18%, transparent)' }}
                            tickFormatter={(v) => (lineEnergyViewMode === 'pct' ? `${Math.round(Number(v))}%` : fmtCompact(Number(v)))}
                          />
                          <YAxis
                            type="category"
                            dataKey="line"
                            width={66}
                            tick={{ fill: 'var(--text)', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => shortLineName(String(v))}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--chart-tooltip-bg)',
                              border: `1px solid var(--chart-tooltip-border)`,
                              borderRadius: 8,
                              color: 'var(--chart-tooltip-text)',
                              fontSize: 12,
                            }}
                            formatter={(v, _name, it) => {
                              const line = (it as unknown as { payload?: { line?: string } }).payload?.line ?? 'Line'
                              return [
                                lineEnergyViewMode === 'pct' ? `${Number(v).toFixed(1)}%` : `${fmt(Number(v), 0)} kWh`,
                                String(line),
                              ]
                            }}
                          />
                          <Bar
                            dataKey={lineEnergyViewMode === 'pct' ? 'pct' : 'kwh'}
                            fill="url(#energy-bars-magenta)"
                            stroke="color-mix(in_srgb, rgb(217 70 239) 55%, transparent)"
                            strokeWidth={1}
                            isAnimationActive={false}
                            radius={[0, 6, 6, 0]}
                          >
                            <LabelList content={lineBarLabel(lineEnergyViewMode)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="min-w-0 border-l border-[color-mix(in_srgb,var(--border)_70%,transparent)] pl-3">
                    <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">Utilities</div>
                    <div className="h-[calc(100%-18px)] min-h-0 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={lineEnergyGrouped.util}
                          layout="vertical"
                          margin={{ left: 4, right: 10, top: 6, bottom: 0 }}
                          barCategoryGap={6}
                          barGap={2}
                          onMouseMove={(st) => {
                            const p =
                              (st as unknown as { activePayload?: Array<{ payload?: { line?: string; kwh?: number } }> }).activePayload?.[0]?.payload
                            if (p?.line && Number.isFinite(Number(p.kwh))) setLineEnergyHover({ line: String(p.line), kwh: Number(p.kwh) })
                          }}
                          onMouseLeave={() => setLineEnergyHover(null)}
                        >
                          <CartesianGrid horizontal={false} stroke="color-mix(in_srgb, var(--text) 10%, transparent)" />
                          <XAxis
                            type="number"
                            domain={lineEnergyViewMode === 'pct' ? [0, 100] : [0, 'auto']}
                            tick={{ fill: 'var(--text)', fontSize: 10 }}
                            axisLine={{ stroke: 'color-mix(in_srgb, var(--text) 22%, transparent)' }}
                            tickLine={{ stroke: 'color-mix(in_srgb, var(--text) 18%, transparent)' }}
                            tickFormatter={(v) => (lineEnergyViewMode === 'pct' ? `${Math.round(Number(v))}%` : fmtCompact(Number(v)))}
                          />
                          <YAxis
                            type="category"
                            dataKey="line"
                            width={66}
                            tick={{ fill: 'var(--text)', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => shortLineName(String(v))}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--chart-tooltip-bg)',
                              border: `1px solid var(--chart-tooltip-border)`,
                              borderRadius: 8,
                              color: 'var(--chart-tooltip-text)',
                              fontSize: 12,
                            }}
                            formatter={(v, _name, it) => {
                              const line = (it as unknown as { payload?: { line?: string } }).payload?.line ?? 'Line'
                              return [
                                lineEnergyViewMode === 'pct' ? `${Number(v).toFixed(1)}%` : `${fmt(Number(v), 0)} kWh`,
                                String(line),
                              ]
                            }}
                          />
                          <Bar
                            dataKey={lineEnergyViewMode === 'pct' ? 'pct' : 'kwh'}
                            fill="url(#energy-bars-magenta)"
                            stroke="color-mix(in_srgb, rgb(217 70 239) 55%, transparent)"
                            strokeWidth={1}
                            isAnimationActive={false}
                            radius={[0, 6, 6, 0]}
                          >
                            <LabelList content={lineBarLabel(lineEnergyViewMode)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0">
          <div className="card card-hover h-full min-h-0 overflow-hidden p-4">
            <DemandTracker variant="embedded" />
          </div>
        </div>
      </div>
    </div>
  )
}

