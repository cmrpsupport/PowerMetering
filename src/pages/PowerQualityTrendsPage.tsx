import { useCallback, useMemo, useRef, useState } from 'react'
import VoltageEventTimeline from '../components/charts/VoltageEventTimeline'
import { PqEmptyState } from '../components/powerQuality/PqEmptyState'
import { PqGlobalStatusBar } from '../components/powerQuality/PqGlobalStatusBar'
import { PqInsightPanel } from '../components/powerQuality/PqInsightPanel'
import PqTrendChart, { type PqChartRow } from '../components/powerQuality/PqTrendChart'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { DateRangePicker } from '../components/ui/DateRangePicker'
import { KpiCard } from '../components/ui/KpiCard'
import { findPlcMeter } from '../constants/plcMeters'
import { useEnhancedAlerts, useHarmonics, useMeterHistory, useNodeRedHealth, usePlcFullSnapshot, useVoltageEvents } from '../hooks/queries'
import { computeFluctuationAlerts, type FluctuationAlert } from '../lib/fluctuationDetection'
import {
  classifyVoltageDeviationPct,
  computePqRollup,
  levelFromFreqDeviationHz,
} from '../lib/pqStatus'
import {
  PQ_FLICKER_CRIT_PST,
  PQ_FLICKER_WARN_PST,
  PQ_FREQ_DEV_CRIT_HZ,
  PQ_FREQ_DEV_WARN_HZ,
  PQ_NOMINAL_HZ,
  PQ_NOMINAL_V_LL,
  PQ_THD_CRIT_PCT,
  PQ_THD_WARN_PCT,
  PQ_VOLTAGE_DEV_CRIT_PCT,
  PQ_VOLTAGE_DEV_WARN_PCT,
} from '../lib/pqStandards'
import {
  aggregateTrendByBucket,
  bucketMsForVisibleSpan,
  downsampleTrendForChart,
  type TrendPoint,
} from '../lib/trendSeries'
import type { MeterSamplePoint } from '../types'
import type { VoltageEvent, VoltageEventType } from '../types'

type RangeOpt = { id: string; label: string; minutes: number }

const RANGE_OPTIONS: RangeOpt[] = [
  { id: 'rt', label: 'Real-time window (1h)', minutes: 60 },
  { id: '6h', label: 'Last 6 hours', minutes: 6 * 60 },
  { id: '24h', label: 'Last 24 hours', minutes: 24 * 60 },
  { id: '7d', label: 'Last 7 days', minutes: 7 * 24 * 60 },
  { id: '30d', label: 'Last 30 days', minutes: 30 * 24 * 60 },
]

type AggOpt = { id: string; label: string; ms: number | null }

const AGG_OPTIONS: AggOpt[] = [
  { id: 'auto', label: 'Auto (by span)', ms: null },
  { id: '5m', label: '5 min', ms: 5 * 60 * 1000 },
  { id: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
]

const ALL_METERS_ID = '__all__'

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
    frequencyHz: Number.isFinite(r.frequency) ? r.frequency : undefined,
    pf: r.powerFactor,
    kvar: r.reactivePowerKvar,
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function typeBadgeColor(type: VoltageEventType): BadgeColor {
  switch (type) {
    case 'sag':
      return 'yellow'
    case 'swell':
      return 'indigo'
    case 'interruption':
      return 'red'
    case 'transient':
      return 'slate'
  }
}

function eventCardSeverity(type: VoltageEventType, magnitudePu: number): 'critical' | 'warning' {
  if (type === 'interruption') return 'critical'
  if (type === 'sag' && magnitudePu < 0.85) return 'critical'
  if (type === 'swell' && magnitudePu > 1.1) return 'critical'
  return 'warning'
}

function kpiStatusFromPqLevel(l: 'normal' | 'warning' | 'critical'): 'normal' | 'warning' | 'critical' | 'good' {
  if (l === 'critical') return 'critical'
  if (l === 'warning') return 'warning'
  return 'good'
}

export function PowerQualityTrendsPage() {
  const { data: snap } = usePlcFullSnapshot()
  const { data: health } = useNodeRedHealth()
  const plcUp = health?.plcLink?.up === true
  const plcLastTs = health?.plcLink?.lastCommunicationTs ?? null

  const meterIds = useMemo(() => Object.keys(snap?.meters ?? {}).sort(), [snap?.meters])
  const [meterId, setMeterId] = useState<string>(() => ALL_METERS_ID)
  const [rangeId, setRangeId] = useState<string>('24h')
  const [aggId, setAggId] = useState<string>('auto')
  const [dateRange, setDateRange] = useState({ from: thirtyDaysAgoIso(), to: todayIso() })
  const [eventFilter, setEventFilter] = useState<VoltageEventType | null>(null)

  const meterSelectRef = useRef<HTMLSelectElement>(null)
  const rangeSelectRef = useRef<HTMLSelectElement>(null)

  const effectiveMeterId = useMemo(() => {
    if (meterId === ALL_METERS_ID) return ALL_METERS_ID
    if (meterId && meterIds.includes(meterId)) return meterId
    return ALL_METERS_ID
  }, [meterId, meterIds])

  const minutes = useMemo(() => RANGE_OPTIONS.find((r) => r.id === rangeId)?.minutes ?? 24 * 60, [rangeId])
  const historyQ = useMeterHistory(minutes, effectiveMeterId === ALL_METERS_ID ? undefined : effectiveMeterId || undefined)
  const raw: MeterSamplePoint[] = useMemo(() => historyQ.data ?? [], [historyQ.data])

  const eventsMeterId = effectiveMeterId === ALL_METERS_ID ? undefined : effectiveMeterId
  const eventsQ = useVoltageEvents(eventsMeterId)
  const events = eventsQ.data ?? []

  const alertsQ = useEnhancedAlerts()
  const pqActiveAlarms = useMemo(
    () => (alertsQ.data ?? []).filter((a) => a.category === 'power_quality' && a.status === 'active'),
    [alertsQ.data],
  )

  const harmonicsMeterId = effectiveMeterId !== ALL_METERS_ID ? effectiveMeterId : meterIds[0] ?? ''
  const harmonicsQ = useHarmonics(harmonicsMeterId)
  const thdSnapshot =
    harmonicsQ.data && typeof harmonicsQ.data === 'object' && 'thdPercent' in harmonicsQ.data
      ? Number((harmonicsQ.data as { thdPercent?: number }).thdPercent)
      : null
  const thdValid = thdSnapshot != null && Number.isFinite(thdSnapshot)

  const spanMs = useMemo(() => {
    if (raw.length < 2) return minutes * 60 * 1000
    const t0 = Date.parse(raw[raw.length - 1]!.ts)
    const t1 = Date.parse(raw[0]!.ts)
    const span = Math.abs(t1 - t0)
    return Number.isFinite(span) && span > 0 ? span : minutes * 60 * 1000
  }, [raw, minutes])

  const autoBucketMs = useMemo(() => bucketMsForVisibleSpan(spanMs), [spanMs])
  const aggBucketMs = useMemo(() => {
    const opt = AGG_OPTIONS.find((a) => a.id === aggId)
    return opt?.ms ?? null
  }, [aggId])
  const effectiveBucketMs = aggBucketMs ?? autoBucketMs

  const { chartData, fluctuationAlerts, bucketedPoints } = useMemo(() => {
    const ptsRaw = raw.map(toTrendPoint)
    const pts =
      effectiveMeterId === ALL_METERS_ID
        ? (() => {
            const acc = new Map<
              string,
              {
                ts: string
                n: number
                kw: number
                voltageV: number
                currentA: number
                pf: number
                kvar: number
                freq: number
                freqN: number
              }
            >()
            for (const p of ptsRaw) {
              const key = p.ts
              const cur = acc.get(key) ?? {
                ts: key,
                n: 0,
                kw: 0,
                voltageV: 0,
                currentA: 0,
                pf: 0,
                kvar: 0,
                freq: 0,
                freqN: 0,
              }
              cur.n += 1
              cur.kw += p.kw
              cur.voltageV += p.voltageV
              cur.currentA += p.currentA
              cur.pf += p.pf ?? 0
              cur.kvar += p.kvar ?? 0
              if (p.frequencyHz !== undefined && Number.isFinite(p.frequencyHz)) {
                cur.freq += p.frequencyHz
                cur.freqN += 1
              }
              acc.set(key, cur)
            }
            return Array.from(acc.values())
              .map((r) => ({
                ts: r.ts,
                kw: r.kw / Math.max(1, r.n),
                voltageV: r.voltageV / Math.max(1, r.n),
                currentA: r.currentA / Math.max(1, r.n),
                pf: r.pf / Math.max(1, r.n),
                kvar: r.kvar / Math.max(1, r.n),
                ...(r.freqN > 0 ? { frequencyHz: r.freq / r.freqN } : {}),
              }))
              .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
          })()
        : ptsRaw

    const down = downsampleTrendForChart(pts, spanMs, aggBucketMs ?? undefined)
    const bucketed = aggregateTrendByBucket(down, effectiveBucketMs)
    const alerts = computeFluctuationAlerts(bucketed, { maxAlerts: 400 })

    const rows = bucketed.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltage: p.voltageV,
      current: p.currentA,
      pf: p.pf ?? null,
      kvar: p.kvar ?? null,
      frequencyHz: p.frequencyHz ?? null,
    }))

    return { chartData: rows, fluctuationAlerts: alerts, bucketedPoints: bucketed }
  }, [raw, effectiveMeterId, spanMs, effectiveBucketMs, aggBucketMs])

  const pqRows: PqChartRow[] = useMemo(() => {
    const thd = thdValid ? thdSnapshot : null
    return bucketedPoints.map((p) => ({
      ts: p.ts,
      voltage: p.voltageV,
      frequencyHz: p.frequencyHz ?? null,
      thdPercent: thd,
      flickerPst: null,
    }))
  }, [bucketedPoints, thdValid, thdSnapshot])

  const fluctuationOnChart = useMemo(() => {
    if (chartData.length < 2) return [] as FluctuationAlert[]
    const t0 = Date.parse(chartData[0]!.ts as string)
    const t1 = Date.parse(chartData[chartData.length - 1]!.ts as string)
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return fluctuationAlerts
    const lo = Math.min(t0, t1)
    const hi = Math.max(t0, t1)
    return fluctuationAlerts.filter((a) => {
      const t = Date.parse(a.ts)
      return t >= lo && t <= hi
    })
  }, [chartData, fluctuationAlerts])

  const eventsInTrendRange = useMemo(() => {
    if (raw.length < 1) return events
    const t0 = Date.parse(raw[0]!.ts)
    const t1 = Date.parse(raw[raw.length - 1]!.ts)
    const lo = Math.min(t0, t1)
    const hi = Math.max(t0, t1)
    return events.filter((e) => {
      const t = new Date(e.ts).getTime()
      return t >= lo && t <= hi
    })
  }, [events, raw])

  const stats = useMemo(() => {
    if (!snap?.meters) return null
    if (effectiveMeterId !== ALL_METERS_ID) {
      const d = snap.meters[effectiveMeterId]
      if (!d) return null
      return { v: d.Voltage_Lave, f: d.Frequency, pf: d.Power_factor, i: d.Current_Ave }
    }

    const list = Object.values(snap.meters)
    if (list.length === 0) return null
    const xs = (sel: (m: (typeof list)[number]) => number) =>
      list.map(sel).filter((n) => Number.isFinite(n) && n > 0)
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN)
    return {
      v: avg(xs((m) => m.Voltage_Lave)),
      f: avg(xs((m) => m.Frequency)),
      pf: avg(list.map((m) => m.Power_factor).filter((n) => Number.isFinite(n) && n > 0)),
      i: avg(xs((m) => m.Current_Ave)),
    }
  }, [snap?.meters, effectiveMeterId])

  const voltageDevPct = useMemo(() => {
    if (stats?.v == null || !Number.isFinite(stats.v)) return null
    return ((stats.v - PQ_NOMINAL_V_LL) / PQ_NOMINAL_V_LL) * 100
  }, [stats?.v])

  const freqDevHz = useMemo(() => {
    if (stats?.f == null || !Number.isFinite(stats.f)) return null
    return stats.f - PQ_NOMINAL_HZ
  }, [stats?.f])

  const rollup = useMemo(
    () =>
      computePqRollup({
        plcConnected: plcUp,
        voltageV: stats?.v ?? null,
        frequencyHz: stats?.f ?? null,
        thdPercent: thdValid ? thdSnapshot : null,
        flickerPst: null,
        voltageEvents: eventsInTrendRange,
        fluctuationAlerts: fluctuationOnChart,
        pqAlertCount: pqActiveAlarms.length,
      }),
    [plcUp, stats?.v, stats?.f, thdValid, thdSnapshot, eventsInTrendRange, fluctuationOnChart, pqActiveAlarms.length],
  )

  const lastHistoryTs = useMemo(() => {
    if (raw.length === 0) return null
    return new Date(raw[0]!.ts).toLocaleString()
  }, [raw])

  const lastUpdateDisplay = useMemo(() => {
    if (plcLastTs) return new Date(plcLastTs).toLocaleString()
    return lastHistoryTs
  }, [plcLastTs, lastHistoryTs])

  const meterName = useMemo(() => {
    if (effectiveMeterId === ALL_METERS_ID) return 'All meters (avg)'
    if (!effectiveMeterId) return '—'
    return findPlcMeter(effectiveMeterId)?.name ?? effectiveMeterId
  }, [effectiveMeterId])

  const filteredEvents = useMemo(() => {
    const fromTs = new Date(dateRange.from).getTime()
    const toTs = new Date(dateRange.to + 'T23:59:59').getTime()
    return events.filter((e) => {
      const t = new Date(e.ts).getTime()
      return t >= fromTs && t <= toTs
    })
  }, [events, dateRange])

  const tableEvents = useMemo(() => {
    if (!eventFilter) return filteredEvents
    return filteredEvents.filter((e) => e.type === eventFilter)
  }, [filteredEvents, eventFilter])

  const counts = useMemo(() => {
    const c: Record<VoltageEventType, number> = { sag: 0, swell: 0, interruption: 0, transient: 0 }
    for (const e of filteredEvents) {
      c[e.type] = (c[e.type] ?? 0) + 1
    }
    return c
  }, [filteredEvents])

  const voltageDevSeries = useMemo(
    () =>
      bucketedPoints.map((p) =>
        PQ_NOMINAL_V_LL > 0 ? ((p.voltageV - PQ_NOMINAL_V_LL) / PQ_NOMINAL_V_LL) * 100 : 0,
      ),
    [bucketedPoints],
  )

  const freqDevSeries = useMemo(
    () => bucketedPoints.map((p) => (p.frequencyHz != null ? p.frequencyHz - PQ_NOMINAL_HZ : 0)),
    [bucketedPoints],
  )

  const deltaEndStart = (arr: number[]) => {
    if (arr.length < 2) return null
    const a = arr[0]!
    const b = arr[arr.length - 1]!
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    return (b - a) / 100
  }

  const worstFluctuation = useMemo(() => {
    if (fluctuationOnChart.length === 0) return null
    let best: FluctuationAlert | null = null
    for (const a of fluctuationOnChart) {
      const mag = a.deltaPct === null ? 0 : Math.abs(a.deltaPct * 100)
      if (!best || mag > (best.deltaPct === null ? 0 : Math.abs(best.deltaPct * 100))) best = a
    }
    return best
  }, [fluctuationOnChart])

  const fluctuationSparkPoints = useMemo(() => {
    const arr = voltageDevSeries
    if (arr.length < 2) return ''
    const mx = Math.max(...arr.map(Math.abs), 1e-6)
    return arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * 200
        const y = 28 - (Math.abs(v) / mx) * 24
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [voltageDevSeries])

  const insight = useMemo(() => {
    const bullets: string[] = []
    if (!plcUp) {
      return {
        bullets: ['PLC link down — live PQ evaluation suspended.'],
        recommendation: 'Restore PLC / fieldbus communication before trusting steady-state metrics.',
      }
    }
    if (rollup.level === 'normal') {
      bullets.push(
        counts.interruption + counts.sag + counts.swell + counts.transient === 0
          ? 'No voltage events in the selected event date range.'
          : `${filteredEvents.length} voltage event(s) in table range — review list below.`,
      )
      bullets.push(
        voltageDevPct != null && Math.abs(voltageDevPct) <= PQ_VOLTAGE_DEV_WARN_PCT
          ? `Voltage within ±${PQ_VOLTAGE_DEV_WARN_PCT}% of nominal (${PQ_NOMINAL_V_LL} V).`
          : `Voltage deviation ${voltageDevPct != null ? `${voltageDevPct >= 0 ? '+' : ''}${voltageDevPct.toFixed(1)}%` : 'n/a'}.`,
      )
      bullets.push(
        freqDevHz != null && Math.abs(freqDevHz) <= PQ_FREQ_DEV_WARN_HZ
          ? `Frequency within ±${PQ_FREQ_DEV_WARN_HZ} Hz of ${PQ_NOMINAL_HZ} Hz.`
          : `Frequency deviation ${freqDevHz != null ? `${freqDevHz >= 0 ? '+' : ''}${freqDevHz.toFixed(2)} Hz` : 'n/a'}.`,
      )
      if (fluctuationOnChart.length === 0) bullets.push('No fluctuation spikes in the trend window.')
      return {
        bullets,
        recommendation:
          fluctuationOnChart.length === 0 && Math.abs(voltageDevPct ?? 0) < PQ_VOLTAGE_DEV_WARN_PCT
            ? 'No action required — maintain routine monitoring.'
            : 'Continue monitoring; confirm loads and capacitor steps if deviations persist.',
      }
    }
    if (rollup.level === 'warning') {
      bullets.push(`${eventsInTrendRange.length} PQ-classified event(s) in the trend span (incl. sags/swells).`)
      if (worstFluctuation)
        bullets.push(
          `Largest fluctuation: ${worstFluctuation.metric.toUpperCase()} ${worstFluctuation.deltaPct === null ? '' : `Δ ${(worstFluctuation.deltaPct * 100).toFixed(0)}%`} at ${new Date(worstFluctuation.ts).toLocaleString()}.`,
        )
      bullets.push(rollup.summaryLine)
      return {
        bullets,
        recommendation:
          'Review motor starts, VSD ramps, and capacitor switching on the affected line; verify sag/swell capture with the utility if repeats occur.',
      }
    }
    bullets.push(rollup.worstLabel)
    bullets.push(`${pqActiveAlarms.length} active PQ alarm(s).`)
    return {
      bullets,
      recommendation:
        'Treat as priority: verify protection trips, check bus voltage at the PCC, and isolate repetitive sag sources before equipment stress accumulates.',
    }
  }, [
    plcUp,
    rollup.level,
    rollup.summaryLine,
    rollup.worstLabel,
    counts,
    filteredEvents.length,
    voltageDevPct,
    freqDevHz,
    fluctuationOnChart.length,
    eventsInTrendRange.length,
    worstFluctuation,
    pqActiveAlarms.length,
  ])

  const exportCsv = useCallback(() => {
    const lines = ['ts,voltage_V,frequency_Hz,thd_pct']
    for (const r of pqRows) {
      lines.push(`${r.ts},${r.voltage},${r.frequencyHz ?? ''},${r.thdPercent ?? ''}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EnergyConsumption_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [pqRows, effectiveMeterId, rangeId])

  const emptyTrend = !historyQ.isLoading && chartData.length === 0

  const focusMeter = () => meterSelectRef.current?.focus()
  const focusRange = () => rangeSelectRef.current?.focus()

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-8">
      <PqGlobalStatusBar
        level={rollup.level}
        lastUpdate={lastUpdateDisplay}
        activeAlarms={pqActiveAlarms.length}
        worstEvent={rollup.worstLabel}
        plcConnected={plcUp}
      />

      <header className="flex min-w-0 flex-col gap-2 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-lg font-semibold text-[var(--text)]">Power Quality</h1>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Decision view: status, IEC-style advisory bands, trends, fluctuation context, and voltage events for maintenance action.
          </p>
        </div>
        <div className="shrink-0 space-y-1 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_90%,transparent)] px-3 py-2 text-[11px] text-[var(--muted)]">
          <div>
            Last data received:{' '}
            <span className="tabular-nums font-medium text-[var(--text)]">{lastUpdateDisplay ?? '—'}</span>
          </div>
          <div>
            Trend bucket: {Math.round(effectiveBucketMs / 60000)} min · IEC ref: EN 50160–style limits (configurable via env)
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] xl:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">Meter</span>
            <select
              ref={meterSelectRef}
              id="pq-meter-select"
              value={effectiveMeterId}
              onChange={(e) => setMeterId(e.target.value)}
              className="nr-input w-full min-w-0 px-2.5 py-2"
            >
              {meterIds.length === 0 ? <option value="">No meters</option> : null}
              <option value={ALL_METERS_ID}>All meters (avg)</option>
              {meterIds.map((id) => (
                <option key={id} value={id}>
                  {findPlcMeter(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">Time range</span>
            <select
              ref={rangeSelectRef}
              id="pq-range-select"
              value={rangeId}
              onChange={(e) => setRangeId(e.target.value)}
              className="nr-input w-full min-w-0 px-2.5 py-2"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">Aggregation</span>
            <select value={aggId} onChange={(e) => setAggId(e.target.value)} className="nr-input w-full min-w-0 px-2.5 py-2">
              {AGG_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
            <button type="button" className="nr-btn-secondary nr-btn px-3 py-2 text-xs font-medium" onClick={exportCsv}>
              Export trend CSV
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
          <span className="text-[var(--muted)]">Scope: </span>
          <span className="break-words font-medium text-[var(--text)]">{meterName}</span>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Voltage deviation"
            value={voltageDevPct == null ? '—' : `${voltageDevPct >= 0 ? '+' : ''}${fmt(voltageDevPct, 2)}`}
            unit="%"
            subtext={`Ref ±${PQ_VOLTAGE_DEV_WARN_PCT}% / ±${PQ_VOLTAGE_DEV_CRIT_PCT}% · nominal ${PQ_NOMINAL_V_LL} V`}
            status={kpiStatusFromPqLevel(classifyVoltageDeviationPct(voltageDevPct ?? 0))}
            deltaPct={deltaEndStart(voltageDevSeries)}
            deltaLabel="trend"
            sparkline={voltageDevSeries.length >= 2 ? voltageDevSeries : undefined}
          />
          <KpiCard
            title="Frequency deviation"
            value={freqDevHz == null ? '—' : `${freqDevHz >= 0 ? '+' : ''}${fmt(freqDevHz, 3)}`}
            unit="Hz"
            subtext={`Ref ±${PQ_FREQ_DEV_WARN_HZ} / ±${PQ_FREQ_DEV_CRIT_HZ} Hz @ ${PQ_NOMINAL_HZ} Hz`}
            status={kpiStatusFromPqLevel(levelFromFreqDeviationHz(freqDevHz))}
            deltaPct={deltaEndStart(freqDevSeries)}
            deltaLabel="trend"
            sparkline={freqDevSeries.length >= 2 ? freqDevSeries : undefined}
          />
          <KpiCard
            title="Voltage THD"
            value={thdValid ? fmt(thdSnapshot!, 2) : '—'}
            unit="%"
            subtext={thdValid ? `Ref ${PQ_THD_WARN_PCT}% / ${PQ_THD_CRIT_PCT}% (IEC guidance)` : 'Harmonic historian not wired — KPI pending'}
            status={
              thdValid
                ? thdSnapshot! >= PQ_THD_CRIT_PCT
                  ? 'critical'
                  : thdSnapshot! >= PQ_THD_WARN_PCT
                    ? 'warning'
                    : 'good'
                : 'normal'
            }
          />
          <KpiCard
            title="Flicker (Pst)"
            value="—"
            unit=""
            subtext={`Ref ${PQ_FLICKER_WARN_PST} / ${PQ_FLICKER_CRIT_PST} Pst · ${!plcUp ? 'PLC offline' : 'Telemetry pending'}`}
            status="normal"
          />
        </div>
      </section>

      <PqInsightPanel level={rollup.level} bullets={insight.bullets} recommendation={insight.recommendation} />

      <section className="min-w-0 space-y-2">
        {historyQ.isLoading ? (
          <div className="h-[min(560px,70vh)] min-h-[320px] animate-pulse rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_12%,var(--card))]" />
        ) : emptyTrend ? (
          <PqEmptyState lastKnownTs={lastHistoryTs} onChangeMeter={focusMeter} onChangeRange={focusRange} />
        ) : (
          <PqTrendChart
            data={pqRows}
            height={560}
            fluctuationAlerts={fluctuationOnChart}
            voltageEvents={eventsInTrendRange}
            nominalVLl={PQ_NOMINAL_V_LL}
          />
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Fluctuation analysis</h2>
          <span className="text-[11px] text-[var(--muted)]">{fluctuationOnChart.length} event(s) in trend window</span>
        </div>
        {fluctuationOnChart.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
            No step-change spikes detected versus prior bucket (threshold-based).
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--text)]">
                <span>
                  Total: <strong>{fluctuationOnChart.length}</strong>
                </span>
                <span>
                  Max |Δ%|:{' '}
                  <strong>
                    {worstFluctuation?.deltaPct == null
                      ? '—'
                      : `${Math.abs(worstFluctuation.deltaPct * 100).toFixed(0)}%`}
                  </strong>
                </span>
                <span>
                  Worst time:{' '}
                  <strong className="tabular-nums">
                    {worstFluctuation ? new Date(worstFluctuation.ts).toLocaleString() : '—'}
                  </strong>
                </span>
              </div>
              <div className="text-[var(--muted)]">
                Line / meter: <span className="font-medium text-[var(--text)]">{meterName}</span> · Severity:{' '}
                <span className="font-medium text-[var(--text)]">
                  {worstFluctuation ? (worstFluctuation.severity === 'critical' ? 'Critical' : 'Warning') : '—'}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">|ΔV %| (bucket)</div>
              <svg width="100%" height="56" viewBox="0 0 200 56" className="overflow-visible text-emerald-400/80">
                <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={fluctuationSparkPoints} />
              </svg>
            </div>
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text)]">Voltage events</h2>
          <p className="text-xs text-[var(--muted)]">Filter the table by type; counts reflect the date window below.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={(from, to) => setDateRange({ from, to })} />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['sag', 'Sags', counts.sag],
              ['swell', 'Swells', counts.swell],
              ['interruption', 'Interruptions', counts.interruption],
              ['transient', 'Transients', counts.transient],
            ] as const
          ).map(([type, label, n]) => {
            const sev = filteredEvents.filter((e) => e.type === type).reduce(
              (acc, e) => {
                const s = eventCardSeverity(e.type, e.magnitudePu)
                return s === 'critical' ? 'critical' : acc === 'critical' ? acc : s
              },
              'warning' as 'critical' | 'warning',
            )
            const active = eventFilter === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setEventFilter((f) => (f === type ? null : type))}
                className={[
                  'rounded-xl border px-3 py-3 text-left transition-colors',
                  active ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]' : 'border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_5%,var(--card))]',
                  sev === 'critical' ? 'ring-1 ring-red-500/35' : 'ring-1 ring-amber-500/20',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
                  <Badge color={typeBadgeColor(type)}>{type}</Badge>
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">{n}</div>
                <div className="mt-1 text-[10px] text-[var(--muted)]">{active ? 'Showing table filter' : 'Click to filter table'}</div>
              </button>
            )
          })}
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Event timeline</h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
            <VoltageEventTimeline events={filteredEvents} />
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">
              Events ({tableEvents.length}
              {eventFilter ? ` · ${eventFilter}` : ''})
            </div>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--muted)]">
                  <th className="whitespace-nowrap px-4 py-2">Time</th>
                  <th className="whitespace-nowrap px-4 py-2">Type</th>
                  <th className="whitespace-nowrap px-4 py-2">Meter / line</th>
                  <th className="whitespace-nowrap px-4 py-2">Phase</th>
                  <th className="whitespace-nowrap px-4 py-2">Duration (ms)</th>
                  <th className="whitespace-nowrap px-4 py-2">Min/Max (pu)</th>
                  <th className="px-4 py-2">Classification</th>
                </tr>
              </thead>
              <tbody>
                {tableEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                      No voltage events in this range
                    </td>
                  </tr>
                )}
                {tableEvents.map((e) => (
                  <tr key={e.id} className="border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)] last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-[var(--muted)]">{new Date(e.ts).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge color={typeBadgeColor(e.type)}>{e.type}</Badge>
                    </td>
                    <td className="px-4 py-2 text-[var(--text)]">{e.meterName}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--text)]">{e.phase}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--text)]">{e.durationMs.toFixed(1)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[var(--text)]">{e.magnitudePu.toFixed(3)}</td>
                    <td className="max-w-[220px] break-words px-4 py-2 text-[var(--muted)]">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
