import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download } from 'lucide-react'
import { useConsumptionReportIntervals, usePlcFullSnapshot } from '../hooks/queries'
import { findPlcMeter } from '../constants/plcMeters'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { Badge } from '../components/ui/Badge'
import type { PlcMeterData } from '../types'
import {
  aggregateConsumptionIntervals,
  consumptionReportToCsv,
  CONSUMPTION_REPORT_HOURS,
} from '../lib/consumptionReport'
import type { ConsumptionGranularity } from '../types'
import { StatCard } from '../components/ui/StatCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'

const GRANULARITY_OPTIONS: { id: ConsumptionGranularity; label: string; hint: string }[] = [
  { id: 'hourly', label: 'Hourly', hint: '' },
  { id: 'daily', label: 'Daily', hint: '' },
  { id: 'weekly', label: 'Weekly', hint: '' },
  { id: 'monthly', label: 'Monthly', hint: '' },
]

const LINE_ORDER = [
  'Cracker Line 1',
  'Cracker Line 2',
  'Pretzel Line',
  'Wafer Line 1',
  'Wafer Line 2',
  'Choco Choco Line',
  'Dynamite Line',
  'XO Line',
  'Maxx Line',
  'Main Line',
  'Utilities Jaguar',
  'Utilities Lighting',
]

const LINE_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#f59e0b', // amber
  '#7c3aed', // purple
  '#0ea5e9', // sky
  '#db2777', // pink
  '#ef4444', // red
  '#14b8a6', // teal
  '#a16207', // brown/amber
  '#4f46e5', // indigo
  '#22c55e', // green
  '#eab308', // yellow
]

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtSnap(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function meterHasData(data: PlcMeterData | undefined): boolean {
  if (!data) return false
  return data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0
}

function gaugeColor(pct: number): 'green' | 'yellow' | 'red' {
  if (!Number.isFinite(pct)) return 'green'
  if (pct >= 66) return 'red'
  if (pct >= 33) return 'yellow'
  return 'green'
}

function Gauge({ pct, color }: { pct: number; color: 'green' | 'yellow' | 'red' }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = 22
  const c = 2 * Math.PI * r
  const dash = (clamped / 100) * c
  const stroke = color === 'red' ? 'var(--danger)' : color === 'yellow' ? 'var(--warning)' : 'var(--success)'

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} stroke="var(--border)" strokeWidth="6" fill="none" opacity={0.6} />
      <circle
        cx="28"
        cy="28"
        r={r}
        stroke={stroke}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
        {Math.round(clamped)}%
      </text>
    </svg>
  )
}

export function ConsumptionReportPage() {
  const [granularity, setGranularity] = useState<ConsumptionGranularity>('daily')
  const [viewMode, setViewMode] = useState<'byTime' | 'byLine'>('byLine')
  const [layoutMode, setLayoutMode] = useState<'cards' | 'table'>('cards')
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  const q = useConsumptionReportIntervals(granularity)
  const snapQ = usePlcFullSnapshot()
  const snap = snapQ.data

  const buckets = useMemo(() => {
    const intervals = q.data ?? []
    return aggregateConsumptionIntervals(intervals, granularity)
  }, [q.data, granularity])

  const totals = useMemo(() => {
    const te = buckets.reduce((s, b) => s + b.totalEnergyKwh, 0)
    const pk = buckets.reduce((m, b) => Math.max(m, b.peakDemandKw), 0)
    return { totalEnergyKwh: te, peakDemandKw: pk }
  }, [buckets])

  const meterNames = useMemo(() => {
    const s = new Set<string>()
    for (const b of buckets) {
      for (const m of Object.keys(b.byMeter)) s.add(m)
    }
    const raw = Array.from(s)
    const ordered = raw
      .slice()
      .sort((a, b) => {
        const ia = LINE_ORDER.indexOf(a)
        const ib = LINE_ORDER.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
    return ordered
  }, [buckets])

  const latestBucket = buckets.length > 0 ? buckets[buckets.length - 1] : null
  // For DAILY, show the last completed day (12am→12am) rather than "today so far".
  const displayBucket = useMemo(() => {
    if (!latestBucket) return null
    if (granularity !== 'daily') return latestBucket
    const now = new Date()
    const last = new Date(latestBucket.lastTs)
    const sameDay =
      now.getFullYear() === last.getFullYear() &&
      now.getMonth() === last.getMonth() &&
      now.getDate() === last.getDate()
    if (!sameDay) return latestBucket
    return buckets.length >= 2 ? buckets[buckets.length - 2] : latestBucket
  }, [buckets, granularity, latestBucket])

  const totalDailyAll =
    displayBucket && meterNames.length > 0
      ? meterNames.reduce((s, m) => s + (displayBucket.byMeter[m]?.energyKwh ?? 0), 0)
      : 0
  const totalCumAll =
    displayBucket && meterNames.length > 0
      ? meterNames.reduce((s, m) => s + (displayBucket.byMeter[m]?.cumulativeKwhEnd ?? 0), 0)
      : 0
  const snapshotLabel = displayBucket ? new Date(displayBucket.lastTs).toLocaleString() : '—'

  const chartData = useMemo(() => {
    if (viewMode === 'byLine') {
      const totalsByLine = meterNames
        .map((m) => ({
          line: m,
          energyKwh: buckets.reduce((s, b) => s + (b.byMeter[m]?.energyKwh ?? 0), 0),
        }))
        .filter((x) => x.energyKwh > 0)
        .sort((a, b) => b.energyKwh - a.energyKwh)

      const total = totalsByLine.reduce((s, x) => s + x.energyKwh, 0) || 1

      return totalsByLine.map((x, idx) => ({
        name: x.line,
        energy: Math.round(x.energyKwh * 1000) / 1000,
        pct: Math.round((x.energyKwh / total) * 1000) / 10, // 1 decimal
        rank: idx + 1,
      }))
    }

    return buckets.map((b) => {
      const row: Record<string, unknown> = {
        name: b.label.length > 18 ? `${b.label.slice(0, 16)}…` : b.label,
        fullLabel: b.label,
      }
      for (const m of meterNames) {
        row[m] = Math.round((b.byMeter[m]?.energyKwh ?? 0) * 1000) / 1000
      }
      return row
    })
  }, [buckets, meterNames])

  const onDownloadCsv = () => {
    const csv = consumptionReportToCsv(buckets, granularity)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consumption-${granularity}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onDownloadSummaryCsv = () => {
    const header = ['LINE', 'KWH', 'PCT_OF_TOTAL', 'CUMULATIVE_KWH']
    const denom = totalDailyAll > 0 ? totalDailyAll : 1
    const rows = meterNames.map((m) => {
      const daily = displayBucket?.byMeter[m]?.energyKwh ?? 0
      const pct = (daily / denom) * 100
      const cum = displayBucket?.byMeter[m]?.cumulativeKwhEnd ?? null
      return [m, daily.toFixed(3), pct.toFixed(2), cum !== null ? String(cum) : '']
    })
    const lines = [header.join(','), ...rows.map((r) => r.join(','))]
    lines.push(['TOTAL', totalDailyAll.toFixed(3), '100.00', String(totalCumAll)].join(','))

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consumption-summary-${granularity}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hours = CONSUMPTION_REPORT_HOURS[granularity]

  return (
    <div className="space-y-6">
      {/* Unified hero panel */}
      <div className="panel overflow-hidden">
        {/* Header row */}
        <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-base font-semibold text-[var(--text)]">Total energy consumption</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">{snapshotLabel}</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="inline-flex overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
              {GRANULARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGranularity(opt.id)}
                  title={opt.hint}
                  className={[
                    'px-3 py-2 text-left text-xs font-medium transition',
                    granularity === opt.id
                      ? 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)]'
                      : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  <div className="leading-none">{opt.label}</div>
                  <div className="mt-0.5 text-[10px] font-normal opacity-80">{opt.hint}</div>
                </button>
              ))}
            </div>

            <SegmentedControl
              value={layoutMode}
              onChange={setLayoutMode}
              options={[
                { id: 'cards', label: 'Cards' },
                { id: 'table', label: 'Detail' },
              ]}
            />

            <button
              type="button"
              onClick={onDownloadSummaryCsv}
            disabled={!displayBucket || q.isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-sm hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] disabled:opacity-50"
            >
              <Download size={16} aria-hidden />
              Summary
            </button>
            <button
              type="button"
              onClick={onDownloadCsv}
              disabled={buckets.length === 0 || q.isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-sm hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] disabled:opacity-50"
            >
              <Download size={16} aria-hidden />
              Export
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="bg-[var(--bg)] px-4 py-4">
          {layoutMode === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {meterNames.map((m) => {
                const daily = displayBucket?.byMeter[m]?.energyKwh ?? 0
                const cum = displayBucket?.byMeter[m]?.cumulativeKwhEnd ?? null
                const denom = totalDailyAll > 0 ? totalDailyAll : 1
                const pct = (daily / denom) * 100
                const sev = gaugeColor(pct)
                const def = PLC_PRODUCTION_METERS.find((x) => x.name === m)
                const subMeterIds = def?.meterIds ?? []
                const isExpandable = subMeterIds.length > 0
                const isOpen = expandedLine === m
                return (
                  <div key={m} className="card card-hover overflow-hidden">
                    <div
                      role={isExpandable ? 'button' : undefined}
                      tabIndex={isExpandable ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (!isExpandable) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedLine((cur) => (cur === m ? null : m))
                        }
                      }}
                      onClick={() => {
                        if (!isExpandable) return
                        setExpandedLine((cur) => (cur === m ? null : m))
                      }}
                      className={[
                        'p-4',
                        isExpandable ? 'cursor-pointer hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-[var(--text)]">{m}</div>
                            {isExpandable ? (
                              <span className="text-[11px] text-[var(--muted)]">
                                {isOpen ? 'Hide meters' : 'Show meters'}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">kWh ({granularity})</div>
                          <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
                            {fmtNum(daily, 0)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{fmtNum(pct, 1)}% of total</div>
                          <div className="mt-2 text-xs text-[var(--muted)] tabular-nums">
                            Cumulative: {cum !== null ? fmtNum(cum, 0) : '—'} kWh
                          </div>
                        </div>
                        <Gauge pct={pct} color={sev} />
                      </div>
                    </div>

                    {isOpen && isExpandable ? (
                      <div className="border-t border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          <span>Powermeters under {m}</span>
                          {def ? (
                            <Link
                              to={`/lines/${def.id}`}
                              className="text-[11px] font-medium normal-case text-[var(--primary)] hover:underline"
                            >
                              Open line dashboard
                            </Link>
                          ) : null}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-1">
                          {subMeterIds.map((meterId) => {
                            const meter = findPlcMeter(meterId)
                            const d = snap?.meters[meterId]
                            return (
                              <div
                                key={meterId}
                                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <Link
                                      to={`/meters/${meterId}`}
                                      className="truncate text-sm font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                                    >
                                      {meter?.name ?? meterId}
                                    </Link>
                                    <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                                      {meter?.model ?? '—'}
                                    </div>
                                  </div>
                                  <Badge color={meterHasData(d) ? 'green' : 'red'}>
                                    {meterHasData(d) ? 'ON' : 'OFF'}
                                  </Badge>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                  <div>
                                    <div className="text-[11px] text-[var(--muted)]">kW</div>
                                    <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Real_power ?? 0, 1)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] text-[var(--muted)]">V</div>
                                    <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Voltage_Lave ?? 0, 0)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] text-[var(--muted)]">A</div>
                                    <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Current_Ave ?? 0, 1)}</div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] text-[var(--muted)]">E (kWh)</div>
                                    <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Real_energy ?? 0, 1)}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Consumption by interval</div>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
                  Cumulative column is the meter total at the end of the interval; period column is energy attributed to
                  that bucket ({granularity}). Scroll horizontally if you have many lines.
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
                <div className="max-h-[min(70vh,560px)] overflow-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)] shadow-[0_1px_0_0_var(--border)]">
                      <tr className="text-[11px] text-[var(--muted)]">
                        <th className="whitespace-nowrap px-4 py-3 text-left font-medium" rowSpan={2}>
                          Period
                        </th>
                        {meterNames.map((m, i) => (
                          <th
                            key={m}
                            colSpan={2}
                            className="border-l border-[var(--border)] px-3 py-2 text-center align-bottom text-[var(--text)]"
                            style={{ borderLeftColor: LINE_COLORS[i % LINE_COLORS.length] }}
                          >
                            <span className="line-clamp-2 font-semibold leading-snug" title={m}>
                              {m}
                            </span>
                          </th>
                        ))}
                        <th
                          className="border-l border-[var(--border)] px-3 py-2 text-center font-semibold text-[var(--text)]"
                          rowSpan={2}
                        >
                          Total
                          <span className="mt-0.5 block text-[10px] font-normal text-[var(--muted)]">kWh</span>
                        </th>
                      </tr>
                      <tr className="border-b border-[var(--border)] text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        {meterNames.map((m, i) => (
                          <Fragment key={`${m}-sub`}>
                            <th className="border-l border-[var(--border)] px-2 py-2 text-right" style={{ borderLeftColor: LINE_COLORS[i % LINE_COLORS.length] }}>
                              Cum.
                            </th>
                            <th className="px-2 py-2 text-right">Period</th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((b, idx) => {
                        let sumDailyAll = 0
                        for (const m of meterNames) sumDailyAll += b.byMeter[m]?.energyKwh ?? 0

                        return (
                          <tr
                            key={b.key}
                            className={[
                              'border-b border-[var(--border)] transition-colors',
                              idx % 2 === 0
                                ? 'bg-[var(--card)]'
                                : 'bg-[color-mix(in_srgb,var(--text)_2.5%,var(--card))]',
                              'hover:bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))]',
                            ].join(' ')}
                          >
                            <td className="max-w-[14rem] whitespace-nowrap px-4 py-2.5 align-top">
                              <div className="font-medium leading-snug text-[var(--text)]">{b.label}</div>
                            </td>
                            {meterNames.map((m, i) => {
                              const cell = b.byMeter[m]
                              const cum = cell?.cumulativeKwhEnd ?? null
                              const daily = cell?.energyKwh ?? 0
                              // Hourly "Period" is kWh for the hour. Treat <2 kWh (~<2 kW avg) as not running.
                              const notRunning = granularity === 'hourly' && cell && Number.isFinite(daily) && Math.abs(daily) < 2
                              return (
                                <Fragment key={`${b.key}:${m}`}>
                                  <td
                                    className="border-l border-[var(--border)] px-2 py-2.5 text-right font-mono text-sm tabular-nums text-[var(--text)]"
                                    style={{ borderLeftColor: LINE_COLORS[i % LINE_COLORS.length] }}
                                  >
                                    {cum !== null ? fmtNum(cum, 0) : '—'}
                                  </td>
                                  <td
                                    className={[
                                      'px-2 py-2.5 text-right font-mono text-sm tabular-nums',
                                      notRunning
                                        ? 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[color-mix(in_srgb,var(--danger)_85%,var(--text))]'
                                        : 'text-[var(--muted)]',
                                    ].join(' ')}
                                    title={notRunning ? 'Line not running (0 kWh this hour)' : undefined}
                                  >
                                    {cell ? fmtNum(daily, 0) : '—'}
                                  </td>
                                </Fragment>
                              )
                            })}
                            <td className="border-l border-[var(--border)] px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-[var(--text)]">
                              {fmtNum(sumDailyAll, 0)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {buckets.length > 0 && (
                      <tfoot className="border-t-2 border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_5%,var(--card))] font-semibold">
                        <tr>
                          <td className="px-4 py-3 text-[var(--text)]">Period total (kWh)</td>
                          {meterNames.map((m) => {
                            const sumDaily = buckets.reduce((s, row) => s + (row.byMeter[m]?.energyKwh ?? 0), 0)
                            return (
                              <Fragment key={`tot:${m}`}>
                                <td className="px-2 py-3" />
                                <td className="px-2 py-3 text-right font-mono text-[var(--text)]">{fmtNum(sumDaily, 0)}</td>
                              </Fragment>
                            )
                          })}
                          <td className="px-3 py-3 text-right font-mono text-[var(--text)]">{fmtNum(totals.totalEnergyKwh, 0)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom KPI row */}
        <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card card-hover p-4">
              <div className="text-xs font-medium text-[var(--muted)]">Total energy (period)</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
                {fmtNum(totals.totalEnergyKwh, 1)} <span className="text-base font-normal text-[var(--muted)]">kWh</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Cumulative: {fmtNum(totalCumAll, 0)} kWh
              </div>
            </div>

            <div className="card card-hover p-4">
              <div className="text-xs font-medium text-[var(--muted)]">Peak demand (interval max)</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
                {fmtNum(totals.peakDemandKw, 1)} <span className="text-base font-normal text-[var(--muted)]">kW</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Window: {hours}h ({granularity})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Granularity buttons removed */}

      {q.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          Failed to load intervals: {(q.error as Error)?.message ?? 'Unknown error'}
        </div>
      ) : null}

      {/* Production Line Energy Totals removed */}

      {/* legacy: table view is now contained in hero */}
    </div>
  )
}
